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
            await serviceRequest.addOrUpdateFoundationMembers(accounts[9], 0, true);

            const [role, status, exists] = await serviceRequest.foundationMembers.call(accounts[9]);
            assert.equal(status, true);

            // Check for non existance Foundation Member
            const [role1, status1, exists1] = await serviceRequest.foundationMembers.call(accounts[8]);
            assert.equal(exists1, false);

            // Add a new member
            await serviceRequest.addOrUpdateFoundationMembers(accounts[8], 1, true);
            const [role2, status2, exists2] = await serviceRequest.foundationMembers.call(accounts[8]);
            assert.equal(exists2, true);
            assert.equal(status2, true);

            // Disable the Foundation Account accounts[8]
            await serviceRequest.addOrUpdateFoundationMembers(accounts[9], 0, false);
            const [role3, status3, exists3] = await serviceRequest.foundationMembers.call(accounts[9]);
            assert.equal(exists3, true);
            assert.equal(status3, false);

            // Disable the Foundation Account accounts[8]
            await serviceRequest.addOrUpdateFoundationMembers(accounts[9], 0, true, {from: accounts[8]});
            const [role4, status4, exists4] = await serviceRequest.foundationMembers.call(accounts[9]);
            assert.equal(exists4, true);
            assert.equal(status4, true);

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

            await token.transfer(accounts[2],  GAmt, {from:accounts[0]});
            await token.approve(serviceRequest.address,GAmt, {from:accounts[2]}); 
            await serviceRequest.deposit(GAmt, {from:accounts[2]});

            await token.transfer(accounts[3],  GAmt, {from:accounts[0]});
            await token.approve(serviceRequest.address,GAmt, {from:accounts[3]}); 
            await serviceRequest.deposit(GAmt, {from:accounts[3]});


            await token.transfer(accounts[4],  GAmt, {from:accounts[0]});
            await token.approve(serviceRequest.address,GAmt, {from:accounts[4]}); 
            await serviceRequest.deposit(GAmt, {from:accounts[4]});

            await token.transfer(accounts[5],  GAmt, {from:accounts[0]});
            await token.approve(serviceRequest.address,GAmt, {from:accounts[5]}); 
            await serviceRequest.deposit(GAmt, {from:accounts[5]});

            await token.transfer(accounts[6],  GAmt, {from:accounts[0]});
            await token.approve(serviceRequest.address,GAmt, {from:accounts[6]}); 
            await serviceRequest.deposit(GAmt, {from:accounts[6]});

            await token.transfer(accounts[7],  GAmt, {from:accounts[0]});
            await token.approve(serviceRequest.address,GAmt, {from:accounts[7]}); 
            await serviceRequest.deposit(GAmt, {from:accounts[7]});

            // Deposit in Foundation Account as well
            await token.transfer(accounts[8],  GAmt, {from:accounts[0]});
            await token.approve(serviceRequest.address,GAmt, {from:accounts[8]}); 
            await serviceRequest.deposit(GAmt, {from:accounts[8]});

            // Create Service Request
            let expiration_i = web3.eth.blockNumber + 100000;
            let metadataDoc_i = 'abcdefghijklmsnopqrstuvwxyz';
            let requestId_i = 0;
            await serviceRequest.createRequest(Amt2,expiration_i, metadataDoc_i, {from: accounts[2]});

            assert.equal((await serviceRequest.nextRequestId.call()).toNumber(), requestId_i + 1);
            assert.equal((await serviceRequest.balances.call(accounts[2])).toNumber(), GAmt - Amt2);
        
            const [requestId, requester, totalFund, metadataDoc, expiration, endSubmission, endEvaluation, status]
            = await serviceRequest.requests.call(requestId_i);

            console.log(requestId.toNumber() + "," + requester + "," +  totalFund.toNumber() + "," +  metadataDoc + "," +  expiration.toNumber() + "," +  endSubmission.toNumber() + "," +  endEvaluation.toNumber() + "," +  status.toNumber());
            console.log("A2 -- " + accounts[2]);

        });

        it("Initial Service Request Operations - Extend Request 4", async function(){

            let newexpiration = 200000;
            console.log("newexpiration = " + newexpiration);
            await serviceRequest.extendRequest(0, newexpiration, {from: accounts[2]});

            const [requestId, requester, totalFund, metadataDoc, expiration, endSubmission, endEvaluation, status]
            = await serviceRequest.requests.call(0);
            console.log(requestId.toNumber() + "," + requester + "," +  totalFund.toNumber() + "," +  metadataDoc + "," +  expiration.toNumber() + "," +  endSubmission.toNumber() + "," +  endEvaluation.toNumber() + "," +  status.toNumber());
            
            assert.equal(expiration.toNumber(), newexpiration);

            // Check the negative test cases
            //testErrorRevert(await serviceRequest.extendRequest(0, newexpiration-1000, {from: accounts[2]})); // Less 
            //testErrorRevert(await serviceRequest.extendRequest(0, newexpiration+1000, {from: accounts[3]})); // Diff account to extend

        });

        it("Initial Service Request Operations - Approve Request 5", async function(){

            const [role0, status0, exists0] = await serviceRequest.foundationMembers.call(accounts[8]);
            console.log("Mem Status " + status0);

            let newexpiration = 300000;
            await serviceRequest.approveRequest(0, newexpiration-200000, newexpiration-100000, newexpiration, {from: accounts[8]});

            const [requestId, requester, totalFund, metadataDoc, expiration, endSubmission, endEvaluation, status]
            = await serviceRequest.requests.call(0);

            console.log(requestId.toNumber() + "," + requester + "," +  totalFund.toNumber() + "," +  metadataDoc + "," +  expiration.toNumber() + "," +  endSubmission.toNumber() + "," +  endEvaluation.toNumber() + "," +  status.toNumber());
            
            assert.equal(expiration.toNumber(), newexpiration);
            assert.equal(endSubmission.toNumber(), newexpiration - 200000);
            assert.equal(endEvaluation.toNumber(), newexpiration - 100000);
            assert.equal(status.toNumber(), 1); // Approved

        });

        it("Initial Service Request Operations - Load Funds into Request 5", async function(){ 

            await serviceRequest.addFundsToRequest(0, Amt6, {from: accounts[6]});
            await serviceRequest.addFundsToRequest(0, Amt7, {from: accounts[7]});

            const [requestId, requester, totalFund, metadataDoc, expiration, endSubmission, endEvaluation, status]
            = await serviceRequest.requests.call(0);

            assert.equal(totalFund.toNumber(), Amt2+Amt6+Amt7);

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

            const a6Bal_b = await serviceRequest.balances.call(accounts[6]);
            const a7Bal_b = await serviceRequest.balances.call(accounts[7]);

            await serviceRequest.closeRequest(0, {from: accounts[8]});
            const [requestId, requester, totalFund, metadataDoc, expiration, endSubmission, endEvaluation, status]
            = await serviceRequest.requests.call(0);

            console.log(requestId.toNumber() + "," + requester + "," +  totalFund.toNumber() + "," +  metadataDoc + "," +  expiration.toNumber() + "," +  endSubmission.toNumber() + "," +  endEvaluation.toNumber() + "," +  status.toNumber());
            
            const a6Bal_a = await serviceRequest.balances.call(accounts[6]);
            const a7Bal_a = await serviceRequest.balances.call(accounts[7]);

            assert.equal(status.toNumber(), 4);
            assert.equal(a6Bal_a.toNumber(), a6Bal_b.toNumber() + Amt6);
            assert.equal(a7Bal_a.toNumber(), a7Bal_b.toNumber() + Amt7);

            // This test should fail as we cant fund to a closed request
            //testErrorRevert(await serviceRequest.addFundsToRequest(0, Amt6, {from: accounts[6]}));
            
        });
        
});
