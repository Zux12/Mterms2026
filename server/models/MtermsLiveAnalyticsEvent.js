const mongoose =
  require('mongoose');


const MtermsLiveAnalyticsEventSchema =
  new mongoose.Schema(
    {

      participantId:{
        type:String,
        required:true,
        trim:true,
        maxlength:200,
        index:true
      },


      event:{
        type:String,
        required:true,
        trim:true,
        maxlength:80,
        index:true
      },


      page:{
        type:String,
        default:'',
        trim:true,
        maxlength:80
      },


      targetId:{
        type:String,
        default:'',
        trim:true,
        maxlength:160,
        index:true
      },


      targetType:{
        type:String,
        default:'',
        trim:true,
        maxlength:80
      },


      deviceType:{
        type:String,
        default:'',
        trim:true,
        maxlength:40
      },


      browser:{
        type:String,
        default:'',
        trim:true,
        maxlength:80
      },


      os:{
        type:String,
        default:'',
        trim:true,
        maxlength:80
      },


      userAgent:{
        type:String,
        default:'',
        maxlength:500
      },


      metadata:{
        type:mongoose.Schema.Types.Mixed,
        default:{}
      }

    },

    {
      timestamps:true
    }

  );


MtermsLiveAnalyticsEventSchema.index({
  createdAt:-1
});


MtermsLiveAnalyticsEventSchema.index({
  event:1,
  createdAt:-1
});


module.exports =
  mongoose.model(
    'MtermsLiveAnalyticsEvent',
    MtermsLiveAnalyticsEventSchema
  );
