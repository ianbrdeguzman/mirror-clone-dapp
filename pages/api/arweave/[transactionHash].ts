import type {NextApiRequest, NextApiResponse} from 'next';

import {GetTransactionRespT, PostTagsT, TransactionStatusE} from '@/types';
import {MIN_NUMBER_OF_CONFIRMATIONS} from '@/constants';

import {initialize} from 'lib/arweave';

const arweave = initialize();

export default async function (
  req: NextApiRequest,
  res: NextApiResponse<GetTransactionRespT | string>,
): Promise<any> {
  try {
    const {transactionHash} = req.query;

    // get transaction data from arweave transaction hash
    const txDataResp = (await arweave.transactions.getData(
      transactionHash as string,
      {
        decode: true,
        string: true,
      },
    )) as string;

    const txData = JSON.parse(txDataResp);

    // get transaction status from arweave transaction hash
    const txStatusResp = await arweave.transactions.getStatus(
      transactionHash as string,
    );

    // confirm transaction status if there are >= 2 confirmation
    const txStatus =
      txStatusResp.status === 200 &&
      txStatusResp.confirmed &&
      txStatusResp.confirmed.number_of_confirmations >=
        MIN_NUMBER_OF_CONFIRMATIONS
        ? TransactionStatusE.CONFIRMED
        : TransactionStatusE.NOT_CONFIRMED;

    // if transaction status is confirmed
    if (txStatus === TransactionStatusE.CONFIRMED) {
      // get transaction tags from transaction hash
      const tx = await arweave.transactions.get(transactionHash as string);

      const tags = {} as PostTagsT;

      (tx.get('tags') as any).forEach((tag) => {
        const key = tag.get('name', {decode: true, string: true});
        tags[key] = tag.get('value', {decode: true, string: true});
      });

      // get arweave block by indep hash
      const block = txStatusResp.confirmed
        ? await arweave.blocks.get(txStatusResp.confirmed.block_indep_hash)
        : null;

      res.status(200).json({
        id: transactionHash as string,
        data: txData,
        status: txStatus,
        timestamp: block?.timestamp,
        tags,
      });
    } else {
      res.status(200).json({
        id: transactionHash as string,
        data: txData,
        status: txStatus,
      });
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown Error';
    res.status(500).json(errorMessage);
  }
}
