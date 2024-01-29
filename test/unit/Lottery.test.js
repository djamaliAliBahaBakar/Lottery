const {developmentChains,networkConfig} = require("../../helper-hardhat-config")
const {getNamedAccounts, deployments, ethers, network} = require("hardhat")
const {assert, expect}= require("chai")

!developmentChains.includes(network.name) ? describe.skip : describe("Lottery",
async function () {
  let lottery, vrfCoordinatorV2Mock, chainId, raffleEntranceFee, deployer,interval


  beforeEach(async function() {
   deployer  = (await getNamedAccounts()).deployer
    await deployments.fixture(["all"])
    chainId = network.config.chainId
    lottery = await ethers.getContract("Lottery", deployer)
    vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer)
    raffleEntranceFee = await lottery.getEntranceFee()
    interval = await lottery.getInterval()
  } )

  describe("constructor",  function() {
    it("initializes the raffle correctly", async function() {
      const lotteryState = await lottery.getLotteryState()

      assert.equal(lotteryState.toString(), "0")
      assert.equal(interval.toString(), networkConfig[chainId]["interval"])
    })
  })

  describe("enterLottery",  function() {
    it("revert when you don't pay enough", async function() {
      await expect(lottery.enterLottery()).to.be.revertedWith("Lottery__NotEnoughETHEntered")
    })

    it("record players when they enter", async function(){
      await lottery.enterLottery({value: raffleEntranceFee})
      const playerFromContract = await lottery.getPlayer(0)
      assert.equal(playerFromContract,deployer)
    })
    it("emit event when enter", async function() {
      await expect(lottery.enterLottery({value:raffleEntranceFee})).to.emit(lottery, "LotteryEntered")
    })
    it("does noy allow entrance when lottery is calculating", async function() {
      await lottery.enterLottery({value: raffleEntranceFee})
      await network.provider.send("evm_increaseTime",[interval.toNumber()+1])
      await network.provider.send("evm_mine",[])
      //We pretend <e are chainlink Keeper
      await lottery.performUpkeep([])
      await expect(lottery.enterLottery({value: raffleEntranceFee})).to.be.revertedWith("Lottery__NotOpen")
    })
  })

  describe("checkUpkeep",  function() {
    it("returns false if people have not sent any ETH", async function() {
      await network.provider.send("evm_increaseTime",[interval.toNumber()+1])
      await network.provider.send("evm_mine",[])
      const {upkeepNeeded} = await lottery.callStatic.checkUpkeep([])
      assert(!upkeepNeeded)
    })
    it("returns false if lottery is not open", async function() {
      await lottery.enterLottery({value: raffleEntranceFee})
      await network.provider.send("evm_increaseTime",[interval.toNumber()+1])
      await network.provider.send("evm_mine",[])
      await lottery.performUpkeep([])
      const lotteryState = await lottery.getLotteryState()
      const {upkeepNeeded} = await lottery.callStatic.checkUpkeep([])
      assert.equal(lotteryState.toString(), "1")
      assert.equal(upkeepNeeded, false)
    })
    it("returns true if enough time has passed, has players, eth, and is open", async () => {
      await lottery.enterLottery({ value: raffleEntranceFee })
      await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
      await network.provider.request({ method: "evm_mine", params: [] })
      const { upkeepNeeded } = await lottery.callStatic.checkUpkeep("0x") // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
      assert(upkeepNeeded)
    })
  })
  describe("PerformUpkeep", function() {
    it("It can only run if checkupkeep is true", async function() {
      await lottery.enterLottery({value: raffleEntranceFee})
      await network.provider.send("evm_increaseTime",[interval.toNumber()+1])
      await network.provider.send("evm_mine",[])
      const tx = await lottery.performUpkeep([])
      assert(tx)
    })
    it("reverts if checkup is false", async () => {
        await expect(lottery.performUpkeep("0x")).to.be.revertedWith(
            "Lottery__NotNeeded"
        )
    })
    it("updates the raffle state and emits a requestId", async () => {
         // Too many asserts in this test!
         await lottery.enterLottery({ value: raffleEntranceFee })
         await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
         await network.provider.request({ method: "evm_mine", params: [] })
         const txResponse = await lottery.performUpkeep("0x") // emits requestId
         const txReceipt = await txResponse.wait(1) // waits 1 block
         const raffleState = await lottery.getLotteryState() // updates state
         const requestId = txReceipt.events[1].args.requestId
         assert(requestId.toNumber() > 0)
         assert(raffleState == 1) // 0 = open, 1 = calculating
     })
  })

  describe("fulfillRandomWords", function () {
     beforeEach(async () => {
         await lottery.enterLottery({ value: raffleEntranceFee })
         await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
         await network.provider.request({ method: "evm_mine", params: [] })
     })
     it("can only be called after performupkeep", async () => {
         await expect(
             vrfCoordinatorV2Mock.fulfillRandomWords(0, lottery.address) // reverts if not fulfilled
         ).to.be.revertedWith("nonexistent request")
         await expect(
             vrfCoordinatorV2Mock.fulfillRandomWords(1, lottery.address) // reverts if not fulfilled
         ).to.be.revertedWith("nonexistent request")
     })

     // This test is too big...
    // This test simulates users entering the raffle and wraps the entire functionality of the raffle
    // inside a promise that will resolve if everything is successful.
    // An event listener for the WinnerPicked is set up
    // Mocks of chainlink keepers and vrf coordinator are used to kickoff this winnerPicked event
    // All the assertions are done once the WinnerPicked event is fired
      it("picks a winner, resets, and sends money", async () => {
          const additionalEntrances = 3 // to test
          const startingIndex = 2
          let startingBalance
          const accounts = await ethers.getSigners()
          for (let i = startingIndex; i < startingIndex + additionalEntrances; i++) { // i = 2; i < 5; i=i+1
              const accountConnectLottery = lottery.connect(accounts[i]) // Returns a new instance of the Raffle contract connected to player
              await accountConnectLottery.enterLottery({ value: raffleEntranceFee })
          }
          const startingTimeStamp = await lottery.getLatestTimeStamps() // stores starting timestamp (before we fire our event)
                    // This will be more important for our staging tests...
          await new Promise(async (resolve, reject) => {
              lottery.once("WinnerPicked", async () => { // event listener for WinnerPicked
                  console.log("WinnerPicked event fired!")
                  // assert throws an error if it fails, so we need to wrap
                  // it in a try/catch so that the promise returns event
                  // if it fails.
                  try {
                      // Now lets get the ending values...
                      const recentWinner = await lottery.getRecentWinner()
                      const raffleState = await lottery.getLotteryState()
                      const winnerBalance = await accounts[2].getBalance()
                      const endingTimeStamp = await lottery.getLatestTimeStamps()
                      await expect(lottery.getPlayer(0)).to.be.reverted
                      // Comparisons to check if our ending values are correct:


                      assert.equal(recentWinner.toString(), accounts[2].address)
                      assert.equal(raffleState, 0)
                      assert.equal(
                          winnerBalance.toString(),
                          startingBalance // startingBalance + ( (raffleEntranceFee * additionalEntrances) + raffleEntranceFee )
                              .add(
                                  raffleEntranceFee
                                      .mul(additionalEntrances)
                                      .add(raffleEntranceFee)
                              )
                              .toString()
                      )
                      assert(endingTimeStamp > startingTimeStamp)
                      resolve() // if try passes, resolves the promise
                  } catch (e) {
                      reject(e) // if try fails, rejects the promise
                  }
              })

              // kicking off the event by mocking the chainlink keepers and vrf coordinator
              try {
                const tx = await lottery.performUpkeep([])
                const txReceipt = await tx.wait(1)
                startingBalance = await accounts[2].getBalance()
                await vrfCoordinatorV2Mock.fulfillRandomWords(
                    txReceipt.events[1].args.requestId,
                    lottery.address
                )
              } catch (e) {
                  reject(e)
              }
          })
      })

   })

})
