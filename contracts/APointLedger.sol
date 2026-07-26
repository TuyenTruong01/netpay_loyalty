// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract APointLedger {
    address public admin; address public operator; bool public paused;
    mapping(address=>uint256) public balanceOf;
    mapping(bytes32=>bool) public rewardProcessed;
    mapping(bytes32=>bool) public redemptionProcessed;
    uint256 public totalIssued; uint256 public totalRedeemed;
    event APointCredited(address indexed customer,uint256 points,bytes32 indexed paymentId);
    event APointRedeemed(address indexed customer,uint256 points,bytes32 indexed orderId);
    error Unauthorized(); error Paused(); error InvalidInput(); error AlreadyProcessed(); error InsufficientPoints(); error NonTransferable();
    modifier onlyAdmin(){if(msg.sender!=admin)revert Unauthorized();_;} modifier onlyOperator(){if(msg.sender!=operator)revert Unauthorized();_;} modifier whenNotPaused(){if(paused)revert Paused();_;}
    constructor(address initialAdmin,address initialOperator){if(initialAdmin==address(0)||initialOperator==address(0))revert InvalidInput();admin=initialAdmin;operator=initialOperator;}
    function setOperator(address next) external onlyAdmin {if(next==address(0))revert InvalidInput();operator=next;}
    function setPaused(bool value) external onlyAdmin {paused=value;}
    function credit(address customer,uint256 points,bytes32 paymentId) external onlyOperator whenNotPaused {if(customer==address(0)||points==0||paymentId==bytes32(0))revert InvalidInput();if(rewardProcessed[paymentId])revert AlreadyProcessed();rewardProcessed[paymentId]=true;balanceOf[customer]+=points;totalIssued+=points;emit APointCredited(customer,points,paymentId);}
    function redeem(address customer,uint256 points,bytes32 orderId) external onlyOperator whenNotPaused {if(customer==address(0)||points==0||orderId==bytes32(0))revert InvalidInput();if(redemptionProcessed[orderId])revert AlreadyProcessed();if(balanceOf[customer]<points)revert InsufficientPoints();redemptionProcessed[orderId]=true;balanceOf[customer]-=points;totalRedeemed+=points;emit APointRedeemed(customer,points,orderId);}
    function transfer(address,uint256) external pure returns(bool){revert NonTransferable();}
}
