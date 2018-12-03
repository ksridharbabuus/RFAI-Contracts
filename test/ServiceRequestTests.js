"use strict";
var  ServiceRequest = artifacts.require("./ServiceRequest.sol");

let Contract = require("truffle-contract");
let TokenAbi = require("singularitynet-token-contracts/abi/SingularityNetToken.json");
let TokenNetworks = require("singularitynet-token-contracts/networks/SingularityNetToken.json");
let TokenBytecode = require("singularitynet-token-contracts/bytecode/SingularityNetToken.json");
let Token = Contract({contractName: "SingularityNetToken", abi: TokenAbi, networks: TokenNetworks, bytecode: TokenBytecode});
Token.setProvider(web3.currentProvider);

var ethereumjsabi  = require('ethereumjs-abi');
var ethereumjsutil = require('ethereumjs-util');
let signFuns       = require('./sign_mpe_funs');

async function testErrorRevert(prom)
{
    let rezE = -1
    try { await prom }
    catch(e) {
        rezE = e.message.indexOf('revert');
        console.log("Catch Block: " + e.message);
    }
    assert(rezE >= 0, "Must generate error and error message must contain revert");
}
  
contract('ServiceRequest', function(accounts) {

    var serviceRequest;
    var tokenAddress;
    var token;
    let N1 = 42000
    let N2 = 420000
    let N3 = 42
    
    let GAmt = 10000;
    let Amt2 = 20;
    let Amt3 = 30;
    let Amt4 = 40;
    let Amt5 = 50;
    let Amt6 = 60;
    let Amt7 = 70;

    before(async () => 
        {
            serviceRequest = await ServiceRequest.deployed();
            tokenAddress = await serviceRequest.token.call();
            token = Token.at(tokenAddress);
        });

    const addAndVerifyFoundationMember = async(_newAccount, _role, _status, _account) => {

        await serviceRequest.addOrUpdateFoundationMembers(_newAccount, _role, _status, {from: _account});

        const [role, status, exists] = await serviceRequest.foundationMembers.call(_newAccount);
        assert.equal(exists, true);
        assert.equal(status, _status);

    };

    const depositTokensToContract = async() => {
        // Deposit amount to respective accounts
        for(var i=2;i<9;i++) {
            await token.transfer(accounts[i],  GAmt, {from:accounts[0]});
            await token.approve(serviceRequest.address,GAmt, {from:accounts[i]}); 
            await serviceRequest.deposit(GAmt, {from:accounts[i]});
        }
    };

    const createRequestAndVerify = async (_amount, _expiration, _metadataDoc, _account) => {

        const requestId_b = await serviceRequest.nextRequestId.call();
        const accountBal_b = await serviceRequest.balances.call(_account);

        await serviceRequest.createRequest(_amount,_expiration, _metadataDoc, {from: _account});

        assert.equal((await serviceRequest.nextRequestId.call()).toNumber(), requestId_b.toNumber() + 1);
        assert.equal((await serviceRequest.balances.call(_account)).toNumber(), accountBal_b.toNumber() - _amount);

        const [requestId_a, requester_a, totalFund_a, metadataDoc_a, expiration_a, endSubmission_a, endEvaluation_a, status_a]
        = await serviceRequest.requests.call(requestId_b.toNumber());

        console.log(requestId_a.toNumber() + "," + requester_a + "," +  totalFund_a.toNumber() + "," +  metadataDoc_a + "," +  expiration_a.toNumber() + "," +  endSubmission_a.toNumber() + "," +  endEvaluation_a.toNumber() + "," +  status_a.toNumber());
        console.log("Creator -- " + _account);

    };

    const extendRequestAndVerify = async(_requestId,  _expiration, _account) => {
        const [requestId_b, requester_b, totalFund_b, metadataDoc_b, expiration_b, endSubmission_b, endEvaluation_b, status_b]
        = await serviceRequest.requests.call(_requestId);

        await serviceRequest.extendRequest(_requestId, _expiration, {from: _account});

        const [requestId_a, requester_a, totalFund_a, metadataDoc_a, expiration_a, endSubmission_a, endEvaluation_a, status_a]
        = await serviceRequest.requests.call(_requestId);
        
        assert.equal(expiration_a.toNumber(), _expiration);
    };

    const approveRequestAndVerify = async (_requestId, _endSubmission, _endEvaluation, _expiration, _account) => {

        const [role0, status0, exists0] = await serviceRequest.foundationMembers.call(_account);
        //console.log("Mem Status " + status0);

        const [requestId_b, requester_b, totalFund_b, metadataDoc_b, expiration_b, endSubmission_b, endEvaluation_b, status_b]
        = await serviceRequest.requests.call(_requestId);
        
        await serviceRequest.approveRequest(_requestId, _endSubmission, _endEvaluation, _expiration, {from: _account});

        const [requestId_a, requester_a, totalFund_a, metadataDoc_a, expiration_a, endSubmission_a, endEvaluation_a, status_a]
        = await serviceRequest.requests.call(_requestId);

        console.log(requestId_a.toNumber() + "," + requester_a + "," +  totalFund_a.toNumber() + "," +  metadataDoc_a + "," +  expiration_a.toNumber() + "," +  endSubmission_a.toNumber() + "," +  endEvaluation_a.toNumber() + "," +  status_a.toNumber());

        assert.equal(expiration_a.toNumber(), _expiration);
        assert.equal(endSubmission_a.toNumber(), _endSubmission);
        assert.equal(endEvaluation_a.toNumber(), _endEvaluation);
        assert.equal(status_a.toNumber(), 1);

    };

    const addFundsAndValidate = async (_requestId, _amount, _account) => {

        const [requestId_b, requester_b, totalFund_b, metadataDoc_b, expiration_b, endSubmission_b, endEvaluation_b, status_b]
        = await serviceRequest.requests.call(_requestId);

        const bal_b = await serviceRequest.balances.call(_account);

        await serviceRequest.addFundsToRequest(_requestId, _amount, {from: _account});

        const [requestId_a, requester_a, totalFund_a, metadataDoc_a, expiration_a, endSubmission_a, endEvaluation_a, status_a]
        = await serviceRequest.requests.call(_requestId);

        const bal_a = await serviceRequest.balances.call(_account);

        assert.equal(totalFund_a.toNumber(), totalFund_b.toNumber() + _amount);
        assert.equal(bal_a.toNumber(), bal_b.toNumber() - _amount);
        
    };

    it ("Initial Wallet Operation 1", async function()
        { 
            // accounts[0] and accounts[1] are used for this testing
            //Deposit 42000 from accounts[0]
            await token.approve(serviceRequest.address,N1, {from:accounts[0]});
            await serviceRequest.deposit(N1, {from:accounts[0]});
            assert.equal((await serviceRequest.balances.call(accounts[0])).toNumber(), N1)

            //Deposit 420000 from accounts[1] (frist we need transfert from a[0] to a[4])
            await token.transfer(accounts[1],  N2, {from:accounts[0]});
            await token.approve(serviceRequest.address,N2, {from:accounts[1]}); 
            await serviceRequest.deposit(N2, {from:accounts[1]});
            
            assert.equal((await serviceRequest.balances.call(accounts[1])).toNumber(), N2)

            assert.equal((await token.balanceOf(serviceRequest.address)).toNumber(), N1 + N2)
           
            //try to withdraw more than we have
            await testErrorRevert(serviceRequest.withdraw(N2 + 1, {from:accounts[1]}))
            
            serviceRequest.withdraw(N3, {from:accounts[1]})
            assert.equal((await serviceRequest.balances.call(accounts[1])).toNumber(), N2 - N3)
            assert.equal((await token.balanceOf(serviceRequest.address)).toNumber(), N1 + N2 - N3)
            assert.equal((await token.balanceOf(accounts[1])).toNumber(), N3)

        }); 

        it ("Fondation Member Operations 2", async function(){

            // accounts[8], accounts[9] -> Foundation Members
            await addAndVerifyFoundationMember(accounts[9], 0, true, accounts[0]);

            // Check for non existance Foundation Member
            const [role1, status1, exists1] = await serviceRequest.foundationMembers.call(accounts[8]);
            assert.equal(exists1, false);

            // Add a new member
            await addAndVerifyFoundationMember(accounts[8], 1, true, accounts[0]);

            // Disable the Foundation Account accounts[8]
            await addAndVerifyFoundationMember(accounts[9], 0, false, accounts[0]);

            // Enable the Foundation Account accounts[8]
            await addAndVerifyFoundationMember(accounts[9], 0, true, accounts[8]);

            // Role=0 should not be able to add new member
            testErrorRevert(await serviceRequest.addOrUpdateFoundationMembers(accounts[8], 1, true, {from: accounts[9]}));

            // At the end of these test accounts[8] => Role:1 and Accounts[9] => Role:0 will be active as Foundation Members

        });
        
        

        it("Initial Service Request Operations - Create Request 3", async function() 
        {
            
            // accounts[2] -> Request Creator
            // accounts[3], accounts[4], accounts[5] -> Solution Submiter
            // accounts[6] & accounts[7] -> Stakers
            // accounts[8] & accounts[9] -> Foundation Members

            // Create Service Request
            let expiration = web3.eth.blockNumber + 100000;
            let metadataDoc = 'abcdefghijklmsnopqrstuvwxyz';

            await depositTokensToContract();
            await createRequestAndVerify(Amt2, expiration, metadataDoc, accounts[2]);

        });


        it("Initial Service Request Operations - Extend Request 4", async function(){

            let newexpiration = 200000;
            await extendRequestAndVerify(0, newexpiration, accounts[2]);

            // Check the negative test cases
            //testErrorRevert(await serviceRequest.extendRequest(0, newexpiration-1000, {from: accounts[2]})); // Less 
            //testErrorRevert(await serviceRequest.extendRequest(0, newexpiration+1000, {from: accounts[3]})); // Diff account to extend

        });

        it("Initial Service Request Operations - Approve Request 5", async function(){
            
            let newexpiration = 300000;
            approveRequestAndVerify(0, newexpiration-200000, newexpiration-100000, newexpiration, accounts[8]);

        });

        it("Initial Service Request Operations - Load Funds into Request 5", async function(){ 
            
            await addFundsAndValidate(0, Amt6, accounts[6]);
            await addFundsAndValidate(0, Amt7, accounts[7]);

        });

        it("Initial Service Request Operations - Submit Solution to Request 6", async function(){ 
            
            let solutionDoc = 'aaalllssllddffgghhjjj';
            await serviceRequest.createOrUpdateSolutionProposal(0, solutionDoc, {from: accounts[3]});
            await serviceRequest.createOrUpdateSolutionProposal(0, solutionDoc, {from: accounts[4]});
            await serviceRequest.createOrUpdateSolutionProposal(0, solutionDoc, {from: accounts[5]});

            const [requestId, requester, totalFund, metadataDoc, expiration, endSubmission, endEvaluation, status]
            = await serviceRequest.requests.call(0);

        });

        it("Initial Service Request Operations - Force Close Request 7", async function(){ 
            
            const a2Bal_b = await serviceRequest.balances.call(accounts[2]);
            const a6Bal_b = await serviceRequest.balances.call(accounts[6]);
            const a7Bal_b = await serviceRequest.balances.call(accounts[7]);

            await serviceRequest.closeRequest(0, {from: accounts[8]});
            const [requestId, requester, totalFund, metadataDoc, expiration, endSubmission, endEvaluation, status]
            = await serviceRequest.requests.call(0);

            console.log(requestId.toNumber() + "," + requester + "," +  totalFund.toNumber() + "," +  metadataDoc + "," +  expiration.toNumber() + "," +  endSubmission.toNumber() + "," +  endEvaluation.toNumber() + "," +  status.toNumber());
            
            const a2Bal_a = await serviceRequest.balances.call(accounts[2]);
            const a6Bal_a = await serviceRequest.balances.call(accounts[6]);
            const a7Bal_a = await serviceRequest.balances.call(accounts[7]);

            assert.equal(status.toNumber(), 4);
            assert.equal(a2Bal_a.toNumber(), a2Bal_b.toNumber() + Amt2);
            assert.equal(a6Bal_a.toNumber(), a6Bal_b.toNumber() + Amt6);
            assert.equal(a7Bal_a.toNumber(), a7Bal_b.toNumber() + Amt7);

            // This test should fail as we cant fund to a closed request
            //testErrorRevert(await serviceRequest.addFundsToRequest(0, Amt6, {from: accounts[6]}));
            
        });

        it("Initial Service Request Operations - Vote and Claim Request 8", async function(){

            // Create Service Request
            let expiration_i = web3.eth.blockNumber + 90;
            let endSubmission_i = web3.eth.blockNumber + 25;
            let endEvaluation_i = web3.eth.blockNumber + 50;
            let metadataDoc_i = 'abcdefghijklmsnopqrstuvwxyz';

            let requestId_i = (await serviceRequest.nextRequestId.call()).toNumber();

            await createRequestAndVerify(Amt2,expiration_i, metadataDoc_i, accounts[2]);

            // Approve the request
            let newexpiration = expiration_i+10;
            await approveRequestAndVerify(requestId_i, endSubmission_i, endEvaluation_i, newexpiration, accounts[8]);

            // Add Funds to the request
            await addFundsAndValidate(requestId_i, Amt6, accounts[6]);
            await addFundsAndValidate(requestId_i, Amt7, accounts[7]);
            
            // Submit the solutions
            let solutionDoc = 'aaalllssllddffgghhjjj';
            await serviceRequest.createOrUpdateSolutionProposal(requestId_i, solutionDoc, {from: accounts[3]});
            await serviceRequest.createOrUpdateSolutionProposal(requestId_i, solutionDoc, {from: accounts[4]});
            await serviceRequest.createOrUpdateSolutionProposal(requestId_i, solutionDoc, {from: accounts[5]});

            // Mine to Increase the blocknumber
            const [requestId_a, requester_a, totalFund_a, metadataDoc_a, expiration_a, endSubmission_a, endEvaluation_a, status_a]
            = await serviceRequest.requests.call(requestId_i);
            await mineBlocks(endSubmission_a.toNumber() - web3.eth.blockNumber);

            // Foundation Votes
            await serviceRequest.vote(requestId_i, accounts[3], {from: accounts[8]});
            await serviceRequest.vote(requestId_i, accounts[5], {from: accounts[8]});

            // Stake Votes
            await serviceRequest.vote(requestId_i, accounts[3], {from: accounts[6]});
            await serviceRequest.vote(requestId_i, accounts[4], {from: accounts[6]});

            // Mine to Increase the blocknumber
            await mineBlocks(endEvaluation_a.toNumber() - web3.eth.blockNumber);

            // Request Claim
            const a3Bal_b = await serviceRequest.balances.call(accounts[3]);

            await serviceRequest.requestClaim(requestId_i, {from: accounts[3]});

            const a3Bal_a = await serviceRequest.balances.call(accounts[3]);

            console.log(a3Bal_b.toNumber() + "=" + a3Bal_a.toNumber());
            assert.equal(a3Bal_a.toNumber(), a3Bal_b.toNumber() + (Amt6/2) + (Amt7/2) + (Amt2/2));

            // Should fail if we try to claim again
            //testErrorRevert(await serviceRequest.requestClaim(requestId_i, {from: accounts[3]}));

        });
       
        const mineBlocks = async(numOfBlocks) => {
            for(var i=0; i<= numOfBlocks; i++) {
                await token.approve(serviceRequest.address,GAmt+i+1, {from:accounts[0]}); 
            }
        };
});
