import Logger from '@machinomy/logger'
import * as Web3 from 'web3'
import * as BigNumber from 'bignumber.js'
import { TransactionResult } from 'truffle-contract'
import ChannelEthContract from './ChannelEthContract'
import ChannelTokenContract from './ChannelTokenContract'
import Signature from './Signature'
import ChannelId from './ChannelId'
import IChannelsDatabase from './storage/IChannelsDatabase'

export type Channel = [string, string, BigNumber.BigNumber, BigNumber.BigNumber, BigNumber.BigNumber]
export type ChannelWithTokenContract = [string, string, BigNumber.BigNumber, BigNumber.BigNumber, BigNumber.BigNumber, string]
export type ChannelFromContract = Channel | ChannelWithTokenContract

const LOG = new Logger('ChannelContract')

export default class ChannelContract {
  channelEthContract: ChannelEthContract
  channelTokenContract: ChannelTokenContract
  channelsDao: IChannelsDatabase

  constructor (web3: Web3, channelsDao: IChannelsDatabase, channelEthContract: ChannelEthContract, channelTokenContract: ChannelTokenContract) {
    this.channelEthContract = channelEthContract
    this.channelTokenContract = channelTokenContract
    this.channelsDao = channelsDao
  }

  async open (sender: string, receiver: string, price: BigNumber.BigNumber, settlementPeriod: number | BigNumber.BigNumber, channelId?: ChannelId | string, tokenContract?: string): Promise<TransactionResult> {
    if (this.isTokenContractDefined(tokenContract)) {
      return this.channelTokenContract.open(sender, receiver, price, settlementPeriod, tokenContract!, channelId)
    } else {
      return this.channelEthContract.open(sender, receiver, price, settlementPeriod, channelId)
    }
  }

  async claim (receiver: string, channelId: string, value: BigNumber.BigNumber, signature: Signature): Promise<TransactionResult> {
    const contract = await this.getContractByChannelId(channelId)
    return contract.claim(receiver, channelId, value, signature)
  }

  async deposit (sender: string, channelId: string, value: BigNumber.BigNumber, tokenContract?: string): Promise<TransactionResult> {
    if (this.isTokenContractDefined(tokenContract)) {
      return this.channelTokenContract.deposit(sender, channelId, value, tokenContract!)
    } else {
      return this.channelEthContract.deposit(sender, channelId, value)
    }
  }

  async getState (channelId: string): Promise<number> {
    const contract = await this.getContractByChannelId(channelId)
    return contract.getState(channelId)
  }

  async getSettlementPeriod (channelId: string): Promise<BigNumber.BigNumber> {
    const contract = await this.getContractByChannelId(channelId)
    return contract.getSettlementPeriod(channelId)
  }

  async startSettle (account: string, channelId: string): Promise<TransactionResult> {
    const contract = await this.getContractByChannelId(channelId)
    return contract.startSettle(account, channelId)
  }

  async finishSettle (account: string, channelId: string): Promise<TransactionResult> {
    const contract = await this.getContractByChannelId(channelId)
    return contract.finishSettle(account, channelId)
  }

  async paymentDigest (channelId: string, value: BigNumber.BigNumber): Promise<string> {
    const channel = await this.channelsDao.firstById(channelId)
    const tokenContract = channel!.tokenContract
    if (this.isTokenContractDefined(tokenContract)) {
      return this.channelTokenContract.paymentDigest(channelId, value, tokenContract)
    } else {
      return this.channelEthContract.paymentDigest(channelId, value)
    }
  }

  async canClaim (channelId: string, payment: BigNumber.BigNumber, receiver: string, signature: Signature): Promise<boolean> {
    const contract = await this.getContractByChannelId(channelId)
    return contract.canClaim(channelId, payment, receiver, signature)
  }

  async channelById (channelId: string): Promise<ChannelFromContract> {
    const contract = await this.getContractByChannelId(channelId)
    return contract.channelById(channelId)
  }

  isTokenContractDefined (tokenContract: string | undefined): boolean {
    return tokenContract !== undefined && tokenContract.startsWith('0x') && parseInt(tokenContract, 16) !== 0
  }

  async getContractByChannelId (channelId: string): Promise<ChannelEthContract | ChannelTokenContract> {
    let contract: ChannelEthContract | ChannelTokenContract = this.channelEthContract
    const channel = await this.channelsDao.firstById(channelId)
    if (!channel) {
      LOG.info(`getContractByChannelId(): Channel ${channelId} is undefined`)
    } else {
      // tslint:disable-next-line:no-unnecessary-type-assertion
      const tokenContract = channel!.tokenContract
      contract = this.isTokenContractDefined(tokenContract) ? this.channelTokenContract : this.channelEthContract
    }
    return contract
  }
}
