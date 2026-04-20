import { ObjectId } from "mongodb";
import { Db } from "mongodb";

Db.ledgerentries.aggregate([
  { $match: { accountId: ObjectId("...") } },
  {
    $group: {
      _id: "$accountId",
      credits: {
        $sum: {
          $cond: [{ $eq: ["$nature", "CREDIT"] }, "$amount", 0]
        }
      },
      debits: {
        $sum: {
          $cond: [{ $eq: ["$nature", "DEBIT"] }, "$amount", 0]
        }
      }
    }
  },
  {
    $project: {
      computedBalance: { $subtract: ["$credits", "$debits"] }
    }
  }
])
