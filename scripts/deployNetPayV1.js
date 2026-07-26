const hre = require('hardhat');

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log('Deploying NetPay V1 with:', deployer.address);

  const StoreRegistry = await hre.ethers.getContractFactory('NetPayStoreRegistry');
  const storeRegistry = await StoreRegistry.deploy(deployer.address);
  await storeRegistry.waitForDeployment();

  const APointLedger = await hre.ethers.getContractFactory('APointLedger');
  const points = await APointLedger.deploy(deployer.address, deployer.address);
  await points.waitForDeployment();

  const PaymentRegistry = await hre.ethers.getContractFactory('NetPayPaymentRegistry');
  const payments = await PaymentRegistry.deploy(deployer.address, deployer.address, await points.getAddress());
  await payments.waitForDeployment();

  await (await points.setOperator(await payments.getAddress())).wait();

  console.log('NetPayStoreRegistry:', await storeRegistry.getAddress());
  console.log('APointLedger:', await points.getAddress());
  console.log('NetPayPaymentRegistry:', await payments.getAddress());
}

main().catch(error => { console.error(error); process.exitCode = 1; });
