// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IAPointLedger { function credit(address customer,uint256 points,bytes32 paymentId) external; function redeem(address customer,uint256 points,bytes32 orderId) external; }

contract NetPayPaymentRegistry {
    address public admin; address public recorder; IAPointLedger public immutable points; bool public paused;
    struct Payment {bytes32 orderId;bytes32 storeId;address customer;address storeWallet;uint256 grossUsdc;uint256 paidUsdc;uint256 pointsRedeemed;bytes32 txReference;uint64 recordedAt;}
    mapping(bytes32=>Payment) public payments; mapping(bytes32=>bool) public usedTxReference;
    event PaymentRecorded(bytes32 indexed orderId,bytes32 indexed storeId,address indexed customer,address storeWallet,uint256 paidUsdc,uint256 pointsEarned,uint256 pointsRedeemed,bytes32 txReference);
    error Unauthorized();error Paused();error InvalidInput();error AlreadyProcessed();error InvalidAmounts();
    modifier onlyAdmin(){if(msg.sender!=admin)revert Unauthorized();_;} modifier whenNotPaused(){if(paused)revert Paused();_;}
    constructor(address initialAdmin,address initialRecorder,address pointLedger){if(initialAdmin==address(0)||initialRecorder==address(0)||pointLedger==address(0))revert InvalidInput();admin=initialAdmin;recorder=initialRecorder;points=IAPointLedger(pointLedger);}
    function setRecorder(address next) external onlyAdmin {if(next==address(0))revert InvalidInput();recorder=next;} function setPaused(bool value) external onlyAdmin {paused=value;}
    function recordPayment(bytes32 orderId,bytes32 storeId,address customer,address storeWallet,uint256 grossUsdc,uint256 paidUsdc,uint256 pointsRedeemed,bytes32 txReference) external whenNotPaused {
        if(msg.sender!=recorder&&msg.sender!=customer) revert Unauthorized();
        if(orderId==bytes32(0)||storeId==bytes32(0)||customer==address(0)||storeWallet==address(0)||txReference==bytes32(0)) revert InvalidInput();
        if(payments[orderId].recordedAt!=0||usedTxReference[txReference]) revert AlreadyProcessed();
        uint256 discount=pointsRedeemed*10000; // 1 point = 0.01 USDC, assuming USDC 6 decimals
        if(grossUsdc!=paidUsdc+discount) revert InvalidAmounts();
        if(pointsRedeemed>0) points.redeem(customer,pointsRedeemed,orderId);
        uint256 pointsEarned=paidUsdc/1_000_000;
        payments[orderId]=Payment(orderId,storeId,customer,storeWallet,grossUsdc,paidUsdc,pointsRedeemed,txReference,uint64(block.timestamp)); usedTxReference[txReference]=true;
        if(pointsEarned>0) points.credit(customer,pointsEarned,txReference);
        emit PaymentRecorded(orderId,storeId,customer,storeWallet,paidUsdc,pointsEarned,pointsRedeemed,txReference);
    }
}
