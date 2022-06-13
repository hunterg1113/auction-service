import AWS from 'aws-sdk'

const dynamodb = new AWS.DynamoDB.DocumentClient()
const sqs = new AWS.SQS()

export async function closeAuction(auction) {
  const params = {
    TableName: process.env.AUCTIONS_TABLE_NAME,
    Key: { id: auction.id },
    UpdateExpression: 'set #status = :status',
    ExpressionAttributeValues: {
      ':status': 'CLOSED'
    },
    ExpressionAttributeNames: {
      '#status': 'status'
    },
  }

  await dynamodb.update(params).promise()

  const { title, seller, highestBid } = auction
  const { amount, bidder } = highestBid

  if(!bidder) {
    await  sqs.sendMessage({
      QueueUrl: process.env.MAIL_QUEUE_URL,
      MessageBody: JSON.stringify({
        subject: 'No bids on aution item :(',
        recipient: seller,
        body: `Bummer! Your item "${title}" was not sold. Better luck next time.`
      })
    }).promise()

    return
  }

  const notifySeller = sqs.sendMessage({
    QueueUrl: process.env.MAIL_QUEUE_URL,
    MessageBody: JSON.stringify({
      subject: 'Your item has been sold!',
      recipient: seller,
      body: `Woohoo! Your item "${title}" has been sold for $${amount}.`
    })
  }).promise()
  
  const notifyBidder = sqs.sendMessage({
    QueueUrl: process.env.MAIL_QUEUE_URL,
    MessageBody: JSON.stringify({
      subject: 'Your won an auction!',
      recipient: bidder,
      body: `What a deal! You got a "${title}" for $${amount}.`
    })
  }).promise()

  return Promise.all([notifySeller, notifyBidder])
}