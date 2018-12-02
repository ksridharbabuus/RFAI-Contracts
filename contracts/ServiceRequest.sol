pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

contract ServiceRequest {
    
    using SafeMath for uint256;
    
    struct Request {
        uint256 requestId;
        address requester;
        uint256 totalFund;
        bytes metadataDoc;
        
        uint256 expiration;
        uint256 endSubmission;
        uint256 endEvaluation;
        
        RequestStatus status;
        
        address[] fundMembers;
        mapping(address => uint256) funds;
        
        address[] submitters;
        mapping(address => Solution) submittedSols;
        
        mapping(address => mapping(address => uint256)) votes;
    }

    // Open -> Rejected
    // Open -> Approved -> Completed -> Closed
    enum RequestStatus { Open, Approved, Rejected, Completed, Closed }
    
    struct Solution {
        bytes solutionDoc;
        uint256 totalVotes;
        
        bool isSubmitted;
        bool isShortlisted;
        bool isClaimed;
    }
    
    uint256 public nextRequestId;
    mapping (uint256 => Request) public requests;
    mapping (address => uint256) public balances;
    
    address owner;
    
    address[] memberKeys;
    struct Member {
        uint role; // 0-Normal member, 1-> Admin Member who can add other members
        bool status; // True -> Actibe, False -> InActive/Deleted
        bool exists; // To check the existstance of the Member
    }
    mapping(address => Member) public foundationMembers;
 
    ERC20 public token; // Address of token contract
    
    constructor (address _token)
    public
    {
        token = ERC20(_token);
        owner = msg.sender;
        nextRequestId = 0;
    }
  
    function deposit(uint256 value) 
    public
    returns(bool) 
    {
        require(token.transferFrom(msg.sender, this, value), "Unable to transfer token to the contract"); 
        balances[msg.sender] = balances[msg.sender].add(value);
        return true;
    }
    
    function withdraw(uint256 value)
    public
    returns(bool)
    {
        require(balances[msg.sender] >= value);
        require(token.transfer(msg.sender, value));
        balances[msg.sender] = balances[msg.sender].sub(value);
        return true;
    }
    
    function updateOwner(address newOwner) public returns(bool) {
        require(owner == msg.sender);
        require(newOwner != address(0));
        
        owner = newOwner;
        
        return true;
    }
    
    function addOrUpdateFoundationMembers(address member, uint role, bool active) public returns (bool) {
        
        require(owner == msg.sender || foundationMembers[msg.sender].role == 1 || foundationMembers[msg.sender].status);
        require(member != address(0));
        require(role == 0 || role == 1);
        
        Member memory mem;
        if(!foundationMembers[member].exists) {
            memberKeys.push(member);
        }
        foundationMembers[member] = mem;
        foundationMembers[member].role = role;
        foundationMembers[member].status = active;
        foundationMembers[member].exists = true;
        
        return true;
    }
    
    function createRequest(uint256 value, uint256 expiration, bytes metadataDoc) 
    public
    returns(bool) 
    {
        require(balances[msg.sender] >= value);
        
        Request memory req;
        requests[nextRequestId] = req;
        
        requests[nextRequestId].requestId = nextRequestId;
        requests[nextRequestId].requester = msg.sender;
        requests[nextRequestId].totalFund = value;
        requests[nextRequestId].metadataDoc = metadataDoc;
        requests[nextRequestId].expiration = expiration;
        requests[nextRequestId].status = RequestStatus.Open;

        balances[msg.sender] = balances[msg.sender].sub(value);

        requests[nextRequestId].funds[msg.sender] = value;
        requests[nextRequestId].fundMembers.push(msg.sender);

        nextRequestId += 1;
        

        return true;
    }

    function depositAndCreateRequest(uint256 value, uint256 expiration, bytes metadataDoc)
    public
    returns(bool)
    {
        require(deposit(value));
        require(createRequest(value, expiration, metadataDoc));
        return true;
    }


    /// the sender can extend the expiration of the request at any time
    function extendRequest(uint256 requestId, uint256 newExpiration) 
    public 
    returns(bool)
    {
        Request storage req = requests[requestId];

        require(msg.sender == req.requester);
        require(req.status == RequestStatus.Open);
        require(newExpiration >= req.expiration);

        requests[requestId].expiration = newExpiration;
        return true;
    }
    
    // Anyone could add funds to the service request
    function addFundsToRequest(uint256 requestId, uint256 amount)
    public
    returns(bool)
    {
        require(balances[msg.sender] >= amount && amount > 0);
        
        Request storage req = requests[requestId];
        
        // Request should be Approved - Means in Progress
        require(req.status == RequestStatus.Approved);
        
        // Request should not be expired
        require(req.expiration > block.number && block.number < req.endEvaluation);

        //tranfser amount from sender to the Service Request
        balances[msg.sender] = balances[msg.sender].sub(amount);
        requests[requestId].totalFund = requests[requestId].totalFund.add(amount);
        
        //Update the respective request funds
        requests[requestId].funds[msg.sender] = requests[requestId].funds[msg.sender].add(amount);
        // Adding funds first time check
        if(requests[requestId].funds[msg.sender] == amount){
            requests[requestId].fundMembers.push(msg.sender);
        } // else member already exists
            
        return true;
    }

    function extendAndAddFundsToRequest(uint256 requestId, uint256 newExpiration, uint256 amount)
    public
    {
        require(extendRequest(requestId, newExpiration));
        require(addFundsToRequest(requestId, amount));
    }
    
    function approveRequest(uint256 requestId, uint256 endSubmission, uint256 endEvaluation, uint256 newExpiration) public returns(bool) {
        
        // Should be foundation Member
        require(foundationMembers[msg.sender].status);
        
        Request memory req = requests[requestId];
        
        // Request should be active
        require(req.status == RequestStatus.Open);
        
        // Request should not be expired
        //require(req.expiration > block.number);
        require(endSubmission < endEvaluation && endEvaluation < newExpiration && newExpiration >= req.expiration );
        
        requests[requestId].status = RequestStatus.Approved;
        requests[requestId].endSubmission = endSubmission;
        requests[requestId].endEvaluation = endEvaluation;
        requests[requestId].expiration = newExpiration;
        
        return true;
    }
    
    function rejectRequest(uint256 requestId) public returns(bool) {
        
        // Should be foundation Member
        require(foundationMembers[msg.sender].status);
        
        Request memory req = requests[requestId];
        
        // Request should be active
        require(req.status == RequestStatus.Open);
        
        settleFundsAndChangeStatus(requestId, RequestStatus.Rejected);
        
        return true;
    }

    function closeRequest(uint256 requestId) public returns(bool) {
        
        // Should be ative foundation Member
        require(foundationMembers[msg.sender].status);
        
        Request memory req = requests[requestId];
        
        // Request should be active
        require(req.status == RequestStatus.Approved);  
        
        settleFundsAndChangeStatus(requestId, RequestStatus.Closed);
        
    }
    
    function settleFundsAndChangeStatus(uint256 requestId, RequestStatus finalStatus) internal returns(bool) {
        
        Request storage req = requests[requestId];
        uint256 amount;
        for(uint256 i=0; i<req.fundMembers.length; i++) {
            amount = req.funds[req.fundMembers[0]];
            req.funds[req.fundMembers[0]].sub(amount);
            balances[req.fundMembers[0]].add(amount);
        }
        req.totalFund = 0;
        req.status = finalStatus;
        
        return true;
    }
    
    function createOrUpdateSolutionProposal(uint256 requestId, bytes solutionDoc)
    public
    returns(bool)
    {
        Request storage req = requests[requestId];

        // Request should be active
        require(req.status == RequestStatus.Approved);
        
        // Request should not be expired
        require(req.expiration > block.number && block.number <= req.endSubmission);
        
        Solution memory sol;

        // Check if already user submitted the solution
        if(!req.submittedSols[msg.sender].isSubmitted) {
            req.submitters.push(msg.sender);
        }
        // Create or Update the Submitted Solution
        req.submittedSols[msg.sender] = sol;
        req.submittedSols[msg.sender].solutionDoc = solutionDoc;
        req.submittedSols[msg.sender].isSubmitted = true;
        
        return true;
        
    }

    // Only users who has stake can vote
    // Foundation members can vote => Shortlist
    function vote(uint256 requestId, address solutionSubmitter) public returns (bool) {
        
        Request storage req = requests[requestId];
        
        // Request should be active
        require(req.status == RequestStatus.Approved);
        
        // Request should not be expired
        require(req.expiration > block.number && block.number > req.endSubmission && block.number <= req.endEvaluation);
        
        // Should be foundation Member or Staking Member to Vote
        require(foundationMembers[msg.sender].status || req.funds[msg.sender] > 0);
        
        // Check for solution Submitter status
        require(req.submittedSols[solutionSubmitter].isSubmitted);
        
        req.submittedSols[solutionSubmitter].totalVotes += 1;
        
        submitVote(requestId, solutionSubmitter, foundationMembers[msg.sender].status);
        
        
        return true;
    }

    function submitVote(uint256 requestId, address solutionSubmitter, bool isFromFoundation) 
    internal 
    {
        
        Request storage req = requests[requestId];

        if(isFromFoundation && !req.submittedSols[solutionSubmitter].isShortlisted) {
            // 0x0 contains foundation shortlisted solutions
            req.votes[address(0)][address(0)] += 1;
            req.votes[address(0)][solutionSubmitter] = 1;
            req.submittedSols[solutionSubmitter].isShortlisted = true;
        }
        
        if(req.votes[msg.sender][solutionSubmitter] == 0)
        {
            req.votes[msg.sender][address(0)] += 1;
            req.votes[msg.sender][solutionSubmitter] = 1;
        }
    }
    
    function requestReClaim(uint256 requestId) public returns (bool) {
        Request storage req = requests[requestId];
        
        // Request should be active and should have funds
        require(req.status == RequestStatus.Approved && req.totalFund > 0);
        
        // Only after expire
        require(block.number > req.expiration);
        
        // Should have stake
        require(req.funds[msg.sender] > 0);
        
        balances[msg.sender] = balances[msg.sender].add(req.funds[msg.sender]);
        req.totalFund = req.totalFund.sub(req.funds[msg.sender]);
        req.funds[msg.sender] = 0;
        
        return true;
    }

    function requestClaim(uint256 requestId) 
    public
    returns (bool)
    {
        uint256 fundationVotes;
        uint256 userStake;
        uint256 totalClaim;
        uint256 userVotes;
        address fundMember;
        Request storage req = requests[requestId];
        
        // Request should be active and should have funds
        require(req.status == RequestStatus.Approved && req.totalFund > 0);
        
        // Request should complete the eveluation and should not expire
        require(block.number > req.endEvaluation && block.number < req.expiration);
        
        // Should be Solution Submitter Only and should have atleast one vote
        require(req.submittedSols[msg.sender].isSubmitted && !req.submittedSols[msg.sender].isClaimed);
        
        fundationVotes = req.votes[address(0)][address(0)];
        
        for(uint256 i=0; i<req.fundMembers.length;i++) {
            userVotes = 0;
            fundMember = req.fundMembers[0];
            userStake = req.funds[fundMember];
            if(userStake > 0) {
                if(req.votes[fundMember][msg.sender] > 0) {
                    userVotes = req.votes[fundMember][address(0)];
                    userStake = userStake.div(userVotes);
                    req.funds[fundMember] = req.funds[fundMember].sub(userStake);
                    totalClaim = totalClaim.add(userStake);
                }
                else if(fundationVotes > 0) {
                    userStake = userStake.div(fundationVotes);
                    req.funds[fundMember] = req.funds[fundMember].sub(userStake);
                    totalClaim = totalClaim.add(userStake);
                }
            }
        }
        
        balances[msg.sender] = balances[msg.sender].add(totalClaim);
        req.submittedSols[msg.sender].isClaimed = true;

        return true;
    }
    
}