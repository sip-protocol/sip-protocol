// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ISwapRouter
 * @notice Minimal Uniswap V3 SwapRouter interface for SIP integration
 * @dev Only includes exactInputSingle and exactInput — the two functions
 *      needed for single-hop and multi-hop private swaps.
 */
interface ISwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    struct ExactInputParams {
        bytes path;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
    }

    /// @notice Swap exact input for single-hop (tokenA → tokenB)
    function exactInputSingle(ExactInputSingleParams calldata params)
        external
        payable
        returns (uint256 amountOut);

    /// @notice Swap exact input for multi-hop (tokenA → tokenB → tokenC)
    function exactInput(ExactInputParams calldata params)
        external
        payable
        returns (uint256 amountOut);
}
