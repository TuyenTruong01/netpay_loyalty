// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract NetPayStoreRegistry {
    address public admin;
    bool public paused;

    struct StoreRecord { bytes32 storeId; address wallet; bool active; uint64 registeredAt; }
    mapping(bytes32 => StoreRecord) public stores;
    mapping(address => bytes32) public storeIdByWallet;

    event StoreRegistered(bytes32 indexed storeId, address indexed wallet);
    event StoreStatusChanged(bytes32 indexed storeId, bool active);
    event StoreWalletChanged(bytes32 indexed storeId, address indexed oldWallet, address indexed newWallet);

    error Unauthorized(); error Paused(); error InvalidInput(); error StoreExists(); error WalletInUse(); error StoreNotFound();
    modifier onlyAdmin(){ if(msg.sender!=admin) revert Unauthorized(); _; }
    modifier whenNotPaused(){ if(paused) revert Paused(); _; }

    constructor(address initialAdmin){ if(initialAdmin==address(0)) revert InvalidInput(); admin=initialAdmin; }
    function setPaused(bool value) external onlyAdmin { paused=value; }
    function transferAdmin(address nextAdmin) external onlyAdmin { if(nextAdmin==address(0)) revert InvalidInput(); admin=nextAdmin; }
    function registerStore(bytes32 storeId,address wallet) external onlyAdmin whenNotPaused {
        if(storeId==bytes32(0)||wallet==address(0)) revert InvalidInput();
        if(stores[storeId].registeredAt!=0) revert StoreExists();
        if(storeIdByWallet[wallet]!=bytes32(0)) revert WalletInUse();
        stores[storeId]=StoreRecord(storeId,wallet,true,uint64(block.timestamp)); storeIdByWallet[wallet]=storeId;
        emit StoreRegistered(storeId,wallet);
    }
    function setStoreActive(bytes32 storeId,bool active) external onlyAdmin { if(stores[storeId].registeredAt==0) revert StoreNotFound(); stores[storeId].active=active; emit StoreStatusChanged(storeId,active); }
    function changeStoreWallet(bytes32 storeId,address newWallet) external onlyAdmin whenNotPaused {
        StoreRecord storage record=stores[storeId]; if(record.registeredAt==0) revert StoreNotFound(); if(newWallet==address(0)) revert InvalidInput(); if(storeIdByWallet[newWallet]!=bytes32(0)) revert WalletInUse();
        address old=record.wallet; delete storeIdByWallet[old]; record.wallet=newWallet; storeIdByWallet[newWallet]=storeId; emit StoreWalletChanged(storeId,old,newWallet);
    }
    function isActiveStoreWallet(address wallet) external view returns(bool){ bytes32 id=storeIdByWallet[wallet]; return id!=bytes32(0)&&stores[id].active; }
}
