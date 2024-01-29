const {ethers, network} = require("hardhat")
const {developmentChains} = require("../helper-hardhat-config")


const BASE_FEE = ethers.utils.parseEther("0.25"); //it is the premium and cost 0.25 LINK
const GAS_PRICE_LINK = 1e9  //calculate value link per gas
module.exports = async ({ getNamedAccounts, deployments }) => {
	    const { deploy, log } = deployments
     	const { deployer } = await getNamedAccounts()
     	const chainId = network.config.chainId
			const args = [BASE_FEE, GAS_PRICE_LINK]

		if (developmentChains.includes(network.name)) {
     		log("Local network detected. Need to delpoy Mock VRFCoordinator");
				await deploy("VRFCoordinatorV2Mock", {
					from: deployer,
					log: true,
					args : args
				})
				log("Mock deployed");
				log("---------------------------------")
     	}

}

module.exports.tags = ["all", "mocks"]
