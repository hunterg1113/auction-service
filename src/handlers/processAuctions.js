import createError from 'http-errors'
import { getEndedAuctions } from '../lib/getEndedAuctions'

async function processAuctions(event, context) {
  try {
    const auctionsToClose = await getEndedAuctions()
    console.log(auctionsToClose)
  } catch(error) {
    console.error(error)
    throw new createError.InternalServerError(error)
  }
  console.log('processAuctions')
}

export const handler = processAuctions
