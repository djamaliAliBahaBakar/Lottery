const { ethers } = require("hardhat")

async function enterRaffle() {
    const raffle = await ethers.getContract("Lottery")
    const entranceFee = await raffle.getEntranceFee()
    await raffle.enterLottery({ value: entranceFee + 1, gasLimit: 5000000 })
    console.log("Entered!")
}

enterRaffle()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
