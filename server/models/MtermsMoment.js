const mongoose =
  require('mongoose');


/* =====================================================
   COMMENT SUBDOCUMENT
===================================================== */

const MtermsMomentCommentSchema =
  new mongoose.Schema(
    {

      participantId:{
        type:String,
        required:true,
        trim:true,
        maxlength:200
      },


      displayName:{
        type:String,
        required:true,
        trim:true,
        maxlength:80
      },


      title:{
        type:String,
        default:'',
        trim:true,
        maxlength:30
      },


      affiliation:{
        type:String,
        default:'',
        trim:true,
        maxlength:100
      },


      message:{
        type:String,
        required:true,
        trim:true,
        maxlength:400
      },


      isDeleted:{
        type:Boolean,
        default:false
      }

    },
    {
      timestamps:true
    }
  );



/* =====================================================
   MOMENT DOCUMENT
===================================================== */

const MtermsMomentSchema =
  new mongoose.Schema(
    {

      participantId:{
        type:String,
        required:true,
        trim:true,
        maxlength:200,
        index:true
      },


      displayName:{
        type:String,
        required:true,
        trim:true,
        maxlength:80
      },


      title:{
        type:String,
        default:'',
        trim:true,
        maxlength:30
      },


      affiliation:{
        type:String,
        default:'',
        trim:true,
        maxlength:100
      },


      /*
        Short message shown below the photo.
      */

      message:{
        type:String,
        default:'',
        trim:true,
        maxlength:300
      },


      /*
        Actual image data will be stored separately
        in MongoDB GridFS.

        This field stores the GridFS file ID only.
      */

      imageFileId:{
        type:mongoose.Schema.Types.ObjectId,
        required:true,
        index:true
      },


      imageMimeType:{
        type:String,
        default:'image/jpeg',
        maxlength:50
      },


      imageWidth:{
        type:Number,
        default:0,
        min:0
      },


      imageHeight:{
        type:Number,
        default:0,
        min:0
      },


      imageSize:{
        type:Number,
        default:0,
        min:0
      },


      /*
        Public visibility.

        Admin can hide a Moment without
        permanently deleting its database record.
      */

      isVisible:{
        type:Boolean,
        default:true,
        index:true
      },


      /*
        Soft deletion by participant/admin.
      */

      isDeleted:{
        type:Boolean,
        default:false,
        index:true
      },


      comments:{
        type:[
          MtermsMomentCommentSchema
        ],
        default:[]
      }

    },
    {
      timestamps:true
    }
  );



/* =====================================================
   INDEXES
===================================================== */

/*
  Efficiently retrieve newest visible Moments.
*/

MtermsMomentSchema.index(
  {
    isDeleted:1,
    isVisible:1,
    createdAt:-1
  }
);


/*
  Efficiently count how many Moments
  one participant/device has uploaded.

  V2 limit will be maximum 10 active Moments
  per participant/device.
*/

MtermsMomentSchema.index(
  {
    participantId:1,
    isDeleted:1
  }
);



module.exports =
  mongoose.model(
    'MtermsMoment',
    MtermsMomentSchema
  );
