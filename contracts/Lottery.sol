

//Enter the lottery

// Pick a random winner

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AutomationCompatibleInterface.sol";

error Lottery__NotEnoughETHEntered();
error Lottery__TransferFailed();
error Lottery__NotOpen();
error Lottery__NotNeeded(uint256 currentBalance, uint256 numberPlayers, uint256 currentState);

/**
 * @title A sample Lottery App
 * @author ABB Djam
 * @notice This Contract is for creating an untamperable decentralized smart contract
 * @dev  This implement chainLink VRF V2 and chainLink Keeper
 */
contract Lottery is VRFConsumerBaseV2 , AutomationCompatibleInterface{


    /* Type declaration*/
    enum LotteryState {
        OPEN,
        CALCULATING
    }
    /* State variables */
    uint256 private immutable i_entranceFee;

    VRFCoordinatorV2Interface immutable i_vrfCoordinator;
    bytes32 private immutable i_gasLane;
    uint64 private immutable i_subscriptionId;
    uint16 private constant REQUEST_CONFIRMATION = 3;
    uint32 private immutable i_callbackRequestLimit;
    uint32 private constant NUM_WORDS = 2;
    uint256 private immutable i_interval;

    /* Lottery variables */
    address payable[] private s_players;
    address private s_recentWinner;
    LotteryState private s_lotteryState; //
    uint256 private s_lastTimeStamp;


    /* Events */
    event LotteryEntered(address indexed player);
    event RequestLotteryWinner(uint256 indexed requestId);
    event WinnerPicked(address indexed winner);

    /* Function */
    constructor(address vrfCoordinatorV2, uint256 entranceFee, bytes32 gasLine,
    uint64 subscriptionId, uint32 callbackRequestLimit, uint256 interval)  VRFConsumerBaseV2(vrfCoordinatorV2){
        i_entranceFee = entranceFee;
        i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorV2);
        i_gasLane = gasLine;
        i_subscriptionId = subscriptionId;
        i_callbackRequestLimit = callbackRequestLimit;
        s_lotteryState = LotteryState.OPEN;
        s_lastTimeStamp = block.timestamp;
        i_interval = interval;
    }

    function enterLottery() public payable {
        if (msg.value < i_entranceFee) {
            revert Lottery__NotEnoughETHEntered();
        }
        if (s_lotteryState != LotteryState.OPEN) {
            revert Lottery__NotOpen();
        }

        s_players.push(payable(msg.sender));
        emit LotteryEntered(msg.sender);
    }

    /**
     * @dev This is the function that the chainLink keeper nodes call
     * They for the upKeepNeeded to return true.
     * The following should be true in order to return true.
     * 1. Our time interval should have passed
     * 2. The lottery should have at least one player and some ETH
     * 3. Our subscription funded with LINK
     * 4. The lottery is in open state
     */

     function checkUpkeep(bytes memory /*calldata  checkData */) public view override
        returns (bool upkeepNeeded, bytes memory /* performData */)
    {
        bool isOpen = (LotteryState.OPEN == s_lotteryState);
        bool timePassed = ((block.timestamp - s_lastTimeStamp) > i_interval);
        bool hasPlayers = (s_players.length > 0);
        bool hasBalance = (address(this).balance > 0);
        upkeepNeeded = (isOpen && timePassed && hasPlayers && hasBalance);
        // We don't use the checkData in this example. The checkData is defined when the Upkeep was registered.
    }



    function performUpkeep(bytes calldata /* performData */) external override {
        (bool upkeepNeeded,) = checkUpkeep("");
        if (!upkeepNeeded) {
            revert Lottery__NotNeeded(address(this).balance, s_players.length, uint256(s_lotteryState));
        }
        s_lotteryState = LotteryState.CALCULATING;
        uint256 requestId = i_vrfCoordinator.requestRandomWords(
            i_gasLane,
            i_subscriptionId,
            REQUEST_CONFIRMATION,
            i_callbackRequestLimit,
            NUM_WORDS
        );
        emit RequestLotteryWinner(requestId);
    }

    function fulfillRandomWords(uint256 /*requestid*/, uint256[] memory randomWords) internal override {
        uint256 indexOfWinner = randomWords[0] % s_players.length;
        address payable recentWinner = s_players[indexOfWinner];
        s_recentWinner = recentWinner;
        s_lotteryState = LotteryState.OPEN;
        s_players = new address payable[](0);
        s_lastTimeStamp = block.timestamp;
        (bool success,) = s_recentWinner.call{value:address(this).balance}("");
        if (!success) {
            revert Lottery__TransferFailed();
        }
        emit WinnerPicked(s_recentWinner);
    }

    /* Pure, view function */
    function getEntranceFee() public view returns(uint256) {
        return i_entranceFee;
    }

    function getPlayer(uint256 index) public view returns(address) {
        return s_players[index];
    }

    function getRecentWinner() public view returns(address) {
        return s_recentWinner;
    }

    function getLotteryState() public view returns(LotteryState) {
        return s_lotteryState;
    }

    function getNumWords() public pure returns (uint256) {
        return NUM_WORDS;
    }

    function getNumberOfPlayers() public view returns(uint256) {
        return s_players.length;
    }

    function getLatestTimeStamps() public view returns(uint256) {
        return s_lastTimeStamp;
    }

    function getRequestConfirmation() public pure returns(uint256) {
        return REQUEST_CONFIRMATION;
    }

    function getInterval() public view returns(uint256) {
      return i_interval;
    }
}
