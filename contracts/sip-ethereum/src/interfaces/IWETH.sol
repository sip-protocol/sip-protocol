// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IWETH
 * @notice Minimal WETH (Wrapped Ether) interface
 */
interface IWETH {
    function deposit() external payable;
    function withdraw(uint256 amount) external;
    function approve(address spender, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}
