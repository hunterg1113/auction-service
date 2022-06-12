import AWS from 'aws-sdk'
import createError from 'http-errors'
import validator from '@middy/validator'
import commonMiddleware from '../lib/commonMiddleware'
import { getAuctionById } from './getAuction'
import placeBidSchema from '../lib/schemas/placeBidSchema'

const dynamodb = new AWS.DynamoDB.DocumentClient()

async function placeBid(event, context) {
  const { id } = event.pathParameters
  const { email } = event.requestContext.authorizer
  const { amount } = event.body
  
  const params = {
    TableName: process.env.AUCTIONS_TABLE_NAME,
    Key: { id },
    UpdateExpression: 'set highestBid.amount = :amount, highestBid.bidder = :bidder',
    ExpressionAttributeValues: {
      ':amount': amount,
      ':bidder': email
    },
    ReturnValues: 'ALL_NEW'
  }

  const auction = await getAuctionById(id)

  // Bid identity validation
  if(auction.sellerEmail === email) {
    throw new createError.Forbidden(`You cannot place bids on your own auctions.`)
  }
  
  // Avoid double bidding
  if(auction.highestBid.bidder === email) {
    throw new createError.Forbidden(`You already have the highest bid.`)
  }
  
  // Auction status validation
  if(auction.status !== 'OPEN') {
    throw new createError.Forbidden(`You cannot place bids on closed auctions.`)
  }
  
  // Bid amount validation
  if(amount <= auction.highestBid.amount){
    throw new createError.Forbidden(`Your bid must be higher than ${auction.highestBid.amount}`)
  }
  
  let updatedAuction
  
  try {
    const result = await dynamodb.update(params).promise()
    updatedAuction = result.Attributes
  } catch(error) {
    console.error(error)
    throw new createError.InternalServerError(error)
  }

  if(!updatedAuction) {
    throw new createError.NotFound(`Auction with ID "${id}" not found!`)
  }

  return {
    statusCode: 200,
    body: JSON.stringify(updatedAuction),
  }
}

export const handler = commonMiddleware(placeBid)
  .use(validator({ inputSchema: placeBidSchema }))
