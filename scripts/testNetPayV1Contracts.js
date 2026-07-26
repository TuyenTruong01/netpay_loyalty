const assert = require('node:assert/strict');
const hre = require('hardhat');

async function expectRevert(action, reason) {
  try {
    await action();
  } catch (error) {
    const message = error?.message || String(error);
    assert(
      message.includes(reason),
      `Expected revert ${reason}, got: ${message}`
    );
    return;
  }

  assert.fail(`Expected revert ${reason}`);
}

function b32(text) {
  return hre.ethers.id(text);
}

async function main() {
  const [admin, recorder, customer, storeWallet, attacker] = await hre.ethers.getSigners();

  const StoreRegistry = await hre.ethers.getContractFactory('NetPayStoreRegistry');
  const storeRegistry = await StoreRegistry.deploy(admin.address);
  await storeRegistry.waitForDeployment();

  const APointLedger = await hre.ethers.getContractFactory('APointLedger');
  const points = await APointLedger.deploy(admin.address, recorder.address);
  await points.waitForDeployment();

  const PaymentRegistry = await hre.ethers.getContractFactory('NetPayPaymentRegistry');
  const payments = await PaymentRegistry.deploy(admin.address, recorder.address, await points.getAddress());
  await payments.waitForDeployment();

  await points.connect(admin).setOperator(await payments.getAddress());

  const storeId = b32('store:minh-chau');
  const orderId = b32('order:001');
  const secondOrderId = b32('order:002');
  const thirdOrderId = b32('order:003');
  const paymentId = b32('arc-tx:001');
  const secondPaymentId = b32('arc-tx:002');

  await storeRegistry.connect(admin).registerStore(storeId, storeWallet.address);
  assert.equal(await storeRegistry.isActiveStoreWallet(storeWallet.address), true);

  await expectRevert(
    () => storeRegistry.connect(attacker).registerStore(b32('store:bad'), attacker.address),
    'Unauthorized'
  );
  await expectRevert(
    () => storeRegistry.connect(admin).registerStore(b32('store:dup-wallet'), storeWallet.address),
    'WalletInUse'
  );

  await expectRevert(
    () => payments.connect(attacker).recordPayment(
      orderId,
      storeId,
      customer.address,
      storeWallet.address,
      10_000_000n,
      10_000_000n,
      0,
      paymentId
    ),
    'Unauthorized'
  );

  await payments.connect(customer).recordPayment(
    orderId,
    storeId,
    customer.address,
    storeWallet.address,
    10_000_000n,
    10_000_000n,
    0,
    paymentId
  );

  assert.equal(await points.balanceOf(customer.address), 10n);
  assert.equal(await points.totalIssued(), 10n);

  await expectRevert(
    () => payments.connect(recorder).recordPayment(
      orderId,
      storeId,
      customer.address,
      storeWallet.address,
      10_000_000n,
      10_000_000n,
      0,
      secondPaymentId
    ),
    'AlreadyProcessed'
  );

  await expectRevert(
    () => payments.connect(recorder).recordPayment(
      secondOrderId,
      storeId,
      customer.address,
      storeWallet.address,
      10_000_000n,
      10_000_000n,
      0,
      paymentId
    ),
    'AlreadyProcessed'
  );

  await expectRevert(
    () => payments.connect(recorder).recordPayment(
      secondOrderId,
      storeId,
      customer.address,
      storeWallet.address,
      10_000_000n,
      9_000_000n,
      50,
      secondPaymentId
    ),
    'InvalidAmounts'
  );

  await expectRevert(
    () => payments.connect(recorder).recordPayment(
      secondOrderId,
      storeId,
      customer.address,
      storeWallet.address,
      10_000_000n,
      9_000_000n,
      100,
      secondPaymentId
    ),
    'InsufficientPoints'
  );

  await payments.connect(recorder).recordPayment(
    secondOrderId,
    storeId,
    customer.address,
    storeWallet.address,
    10_000_000n,
    9_950_000n,
    5,
    secondPaymentId
  );

  assert.equal(await points.balanceOf(customer.address), 14n);
  assert.equal(await points.totalRedeemed(), 5n);

  await expectRevert(
    () => points.connect(customer).transfer(attacker.address, 1),
    'NonTransferable'
  );

  await points.connect(admin).setPaused(true);
  await expectRevert(
    () => payments.connect(recorder).recordPayment(
      thirdOrderId,
      storeId,
      customer.address,
      storeWallet.address,
      1_000_000n,
      1_000_000n,
      0,
      b32('arc-tx:003')
    ),
    'Paused'
  );

  console.log('Paynet Loyalty V1 contract checks passed.');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
