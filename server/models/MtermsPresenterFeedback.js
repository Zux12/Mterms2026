const mongoose = require('mongoose');


const MtermsPresenterFeedbackSchema =
  new mongoose.Schema(
    {

      participantId:{
        type:String,
        required:true,
        trim:true,
        maxlength:200,
        index:true
      },


      presenterId:{
        type:String,
        required:true,
        trim:true,
        maxlength:120,
        index:true
      },


      sessionId:{
        type:String,
        required:true,
        trim:true,
        maxlength:120,
        index:true
      },


      rating:{
        type:Number,
        required:true,
        min:1,
        max:5
      },


      comment:{
        type:String,
        default:'',
        trim:true,
        maxlength:1000
      },


      isDeleted:{
        type:Boolean,
        default:false,
        index:true
      }

    },
    {
      timestamps:true
    }
  );


/*
  One participant/device can have only ONE
  feedback record for each presenter.

  If they edit their feedback later,
  the same MongoDB document is updated.
*/

MtermsPresenterFeedbackSchema.index(
  {
    participantId:1,
    presenterId:1
  },
  {
    unique:true
  }
);


/*
  Useful for Admin aggregation by presenter.
*/

MtermsPresenterFeedbackSchema.index(
  {
    presenterId:1,
    isDeleted:1
  }
);


module.exports =
  mongoose.model(
    'MtermsPresenterFeedback',
    MtermsPresenterFeedbackSchema
  );
