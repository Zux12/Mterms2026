const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const { Readable } = require('stream');

const MtermsMoment =
  require('../models/MtermsMoment');

const router =
  express.Router();


/* =====================================================
   MULTER
   Memory only.

   The browser will already compress the image before
   upload. Multer keeps it temporarily in memory before
   we stream it into MongoDB GridFS.
===================================================== */

const upload =
  multer({
    storage:
      multer.memoryStorage(),

    limits:{
      fileSize:
        2 * 1024 * 1024
    },

    fileFilter:
      (
        req,
        file,
        callback
      )=>{

        const allowed =
          [
            'image/jpeg',
            'image/png',
            'image/webp'
          ];


        if(
          !allowed.includes(
            file.mimetype
          )
        ){

          return callback(
            new Error(
              'Only JPEG, PNG and WebP images are allowed'
            )
          );

        }


        callback(
          null,
          true
        );

      }
  });


/* =====================================================
   HELPERS
===================================================== */

function cleanString(
  value,
  maxLength
){

  return String(
    value || ''
  )
    .trim()
    .slice(
      0,
      maxLength
    );

}


function validObjectId(
  value
){

  return mongoose
    .Types
    .ObjectId
    .isValid(
      value
    );

}


function getGridFSBucket(){

  if(
    !mongoose.connection.db
  ){

    throw new Error(
      'MongoDB connection not ready'
    );

  }


  return new mongoose.mongo.GridFSBucket(
    mongoose.connection.db,
    {
      bucketName:
        'mtermsMoments'
    }
  );

}


function serialiseComment(
  comment
){

  return {

    id:
      String(
        comment._id
      ),

    participantId:
      comment.participantId || '',

    displayName:
      comment.displayName || '',

    title:
      comment.title || '',

    affiliation:
      comment.affiliation || '',

    message:
      comment.message || '',

    createdAt:
      comment.createdAt,

    updatedAt:
      comment.updatedAt

  };

}


function serialiseMoment(
  moment
){

  return {

    id:
      String(
        moment._id
      ),

    participantId:
      moment.participantId || '',

    displayName:
      moment.displayName || '',

    title:
      moment.title || '',

    affiliation:
      moment.affiliation || '',

    message:
      moment.message || '',

    imageUrl:
      `/api/mterms-moments/${String(moment._id)}/image`,

    imageWidth:
      Number(
        moment.imageWidth || 0
      ),

    imageHeight:
      Number(
        moment.imageHeight || 0
      ),

    imageSize:
      Number(
        moment.imageSize || 0
      ),

    createdAt:
      moment.createdAt,

    updatedAt:
      moment.updatedAt,

    comments:
      (
        moment.comments ||
        []
      )
      .filter(
        comment =>
          !comment.isDeleted
      )
      .map(
        serialiseComment
      )

  };

}



/* =====================================================
   HEALTH
===================================================== */

router.get(
  '/health',
  (
    req,
    res
  )=>{

    res.json({
      ok:true,
      service:
        'mterms-moments'
    });

  }
);



/* =====================================================
   GET MOMENTS FEED
===================================================== */

/*
  GET /api/mterms-moments

  Returns newest visible Moments.
*/

router.get(
  '/',
  async (
    req,
    res
  )=>{

    try{

      const limit =
        Math.min(
          Math.max(
            Number(
              req.query.limit ||
              100
            ),
            1
          ),
          200
        );


      const moments =
        await MtermsMoment
          .find({
            isDeleted:false,
            isVisible:true
          })
          .sort({
            createdAt:-1
          })
          .limit(
            limit
          )
          .lean();


      res.json({
        ok:true,

        moments:
          moments.map(
            serialiseMoment
          )
      });


    }catch(error){

      console.error(
        'MTERMS Moments feed GET error:',
        error
      );


      res
        .status(500)
        .json({
          ok:false,
          error:
            'Unable to load MTERMS Moments'
        });

    }

  }
);



/* =====================================================
   GET ONE MOMENT
===================================================== */

router.get(
  '/:id',
  async (
    req,
    res,
    next
  )=>{

    /*
      Prevent this route from swallowing
      dedicated routes such as /health.
    */

    if(
      req.params.id ===
      'health'
    ){

      return next();

    }


    if(
      !validObjectId(
        req.params.id
      )
    ){

      return res
        .status(400)
        .json({
          ok:false,
          error:
            'Invalid Moment ID'
        });

    }


    try{

      const moment =
        await MtermsMoment
          .findOne({
            _id:req.params.id,
            isDeleted:false,
            isVisible:true
          })
          .lean();


      if(
        !moment
      ){

        return res
          .status(404)
          .json({
            ok:false,
            error:
              'Moment not found'
          });

      }


      res.json({
        ok:true,
        moment:
          serialiseMoment(
            moment
          )
      });


    }catch(error){

      console.error(
        'MTERMS Moment GET error:',
        error
      );


      res
        .status(500)
        .json({
          ok:false,
          error:
            'Unable to load Moment'
        });

    }

  }
);



/* =====================================================
   IMAGE STREAM
===================================================== */

/*
  GET /api/mterms-moments/:id/image
*/

router.get(
  '/:id/image',
  async (
    req,
    res
  )=>{

    if(
      !validObjectId(
        req.params.id
      )
    ){

      return res
        .status(400)
        .end();

    }


    try{

      const moment =
        await MtermsMoment
          .findOne({
            _id:req.params.id,
            isDeleted:false,
            isVisible:true
          })
          .lean();


      if(
        !moment
      ){

        return res
          .status(404)
          .end();

      }


      const bucket =
        getGridFSBucket();


      res.setHeader(
        'Content-Type',
        moment.imageMimeType ||
        'image/jpeg'
      );


      res.setHeader(
        'Cache-Control',
        'public, max-age=86400'
      );


      const stream =
        bucket
          .openDownloadStream(
            moment.imageFileId
          );


      stream.on(
        'error',
        error => {

          console.error(
            'MTERMS Moment image stream error:',
            error
          );


          if(
            !res.headersSent
          ){

            res
              .status(404)
              .end();

          }else{

            res.end();

          }

        }
      );


      stream.pipe(
        res
      );


    }catch(error){

      console.error(
        'MTERMS Moment image GET error:',
        error
      );


      res
        .status(500)
        .end();

    }

  }
);



/* =====================================================
   CREATE MOMENT
===================================================== */

/*
  POST /api/mterms-moments

  multipart/form-data

  Fields:
  participantId
  displayName
  title
  affiliation
  message
  imageWidth
  imageHeight

  File:
  image
*/

router.post(
  '/',
  upload.single(
    'image'
  ),
  async (
    req,
    res
  )=>{

    let uploadedFileId =
      null;


    try{

      const participantId =
        cleanString(
          req.body?.participantId,
          200
        );


      const displayName =
        cleanString(
          req.body?.displayName,
          80
        );


      const title =
        cleanString(
          req.body?.title,
          30
        );


      const affiliation =
        cleanString(
          req.body?.affiliation,
          100
        );


      const message =
        cleanString(
          req.body?.message,
          300
        );


      const imageWidth =
        Math.max(
          Number(
            req.body?.imageWidth ||
            0
          ),
          0
        );


      const imageHeight =
        Math.max(
          Number(
            req.body?.imageHeight ||
            0
          ),
          0
        );


      if(
        !participantId
      ){

        return res
          .status(400)
          .json({
            ok:false,
            error:
              'Participant ID is required'
          });

      }


      if(
        !displayName
      ){

        return res
          .status(400)
          .json({
            ok:false,
            error:
              'Display name is required'
          });

      }


      if(
        !req.file
      ){

        return res
          .status(400)
          .json({
            ok:false,
            error:
              'Photo is required'
          });

      }


      /*
        Maximum 10 active Moments
        per participant/device.
      */

      const count =
        await MtermsMoment
          .countDocuments({
            participantId,
            isDeleted:false
          });


      if(
        count >= 10
      ){

        return res
          .status(400)
          .json({
            ok:false,
            error:
              'Maximum of 10 Moments reached for this device'
          });

      }


      const bucket =
        getGridFSBucket();


      const uploadStream =
        bucket
          .openUploadStream(
            `mterms-moment-${Date.now()}`,
            {
              contentType:
                req.file.mimetype,

              metadata:{
                participantId,
                source:
                  'mterms-live-v2'
              }
            }
          );


      uploadedFileId =
        uploadStream.id;


      const readable =
        Readable.from(
          req.file.buffer
        );


      await new Promise(
        (
          resolve,
          reject
        )=>{

          readable
            .pipe(
              uploadStream
            )
            .on(
              'error',
              reject
            )
            .on(
              'finish',
              resolve
            );

        }
      );


      const moment =
        await MtermsMoment
          .create({

            participantId,

            displayName,

            title,

            affiliation,

            message,

            imageFileId:
              uploadedFileId,

            imageMimeType:
              req.file.mimetype,

            imageWidth,

            imageHeight,

            imageSize:
              req.file.size,

            isVisible:true,

            isDeleted:false,

            comments:[]

          });


      res
        .status(201)
        .json({
          ok:true,
          moment:
            serialiseMoment(
              moment.toObject()
            )
        });


    }catch(error){

      console.error(
        'MTERMS Moment POST error:',
        error
      );


      /*
        If the image reached GridFS but
        document creation failed, remove
        the orphaned file.
      */

      if(
        uploadedFileId
      ){

        try{

          await getGridFSBucket()
            .delete(
              uploadedFileId
            );

        }catch(cleanupError){

          console.error(
            'MTERMS Moment GridFS cleanup error:',
            cleanupError
          );

        }

      }


      res
        .status(500)
        .json({
          ok:false,
          error:
            'Unable to share Moment'
        });

    }

  }
);



/* =====================================================
   ADD COMMENT
===================================================== */

/*
  POST /api/mterms-moments/:id/comments
*/

router.post(
  '/:id/comments',
  async (
    req,
    res
  )=>{

    if(
      !validObjectId(
        req.params.id
      )
    ){

      return res
        .status(400)
        .json({
          ok:false,
          error:
            'Invalid Moment ID'
        });

    }


    try{

      const participantId =
        cleanString(
          req.body?.participantId,
          200
        );


      const displayName =
        cleanString(
          req.body?.displayName,
          80
        );


      const title =
        cleanString(
          req.body?.title,
          30
        );


      const affiliation =
        cleanString(
          req.body?.affiliation,
          100
        );


      const message =
        cleanString(
          req.body?.message,
          400
        );


      if(
        !participantId ||
        !displayName ||
        !message
      ){

        return res
          .status(400)
          .json({
            ok:false,
            error:
              'Participant, display name and comment are required'
          });

      }


      const moment =
        await MtermsMoment
          .findOne({
            _id:req.params.id,
            isDeleted:false,
            isVisible:true
          });


      if(
        !moment
      ){

        return res
          .status(404)
          .json({
            ok:false,
            error:
              'Moment not found'
          });

      }


      moment.comments.push({

        participantId,

        displayName,

        title,

        affiliation,

        message,

        isDeleted:false

      });


      await moment.save();


      const created =
        moment.comments[
          moment.comments.length -
          1
        ];


      res
        .status(201)
        .json({
          ok:true,
          comment:
            serialiseComment(
              created
            )
        });


    }catch(error){

      console.error(
        'MTERMS Moment comment POST error:',
        error
      );


      res
        .status(500)
        .json({
          ok:false,
          error:
            'Unable to post comment'
        });

    }

  }
);



/* =====================================================
   DELETE OWN COMMENT
===================================================== */

/*
  DELETE
  /api/mterms-moments/:momentId/comments/:commentId

  Body:
  {
    participantId
  }
*/

router.delete(
  '/:momentId/comments/:commentId',
  async (
    req,
    res
  )=>{

    if(
      !validObjectId(
        req.params.momentId
      )
    ){

      return res
        .status(400)
        .json({
          ok:false,
          error:
            'Invalid Moment ID'
        });

    }


    try{

      const participantId =
        cleanString(
          req.body?.participantId,
          200
        );


      if(
        !participantId
      ){

        return res
          .status(400)
          .json({
            ok:false,
            error:
              'Participant ID is required'
          });

      }


      const moment =
        await MtermsMoment
          .findOne({
            _id:
              req.params.momentId,
            isDeleted:false
          });


      if(
        !moment
      ){

        return res
          .status(404)
          .json({
            ok:false,
            error:
              'Moment not found'
          });

      }


      const comment =
        moment.comments.id(
          req.params.commentId
        );


      if(
        !comment ||
        comment.isDeleted
      ){

        return res
          .status(404)
          .json({
            ok:false,
            error:
              'Comment not found'
          });

      }


      if(
        comment.participantId !==
        participantId
      ){

        return res
          .status(403)
          .json({
            ok:false,
            error:
              'You can only delete your own comment'
          });

      }


      comment.isDeleted =
        true;


      await moment.save();


      res.json({
        ok:true
      });


    }catch(error){

      console.error(
        'MTERMS Moment comment DELETE error:',
        error
      );


      res
        .status(500)
        .json({
          ok:false,
          error:
            'Unable to delete comment'
        });

    }

  }
);



/* =====================================================
   DELETE OWN MOMENT
===================================================== */

/*
  DELETE /api/mterms-moments/:id

  Body:
  {
    participantId
  }

  Soft-delete database record.
  Also remove the associated GridFS file.
*/

router.delete(
  '/:id',
  async (
    req,
    res
  )=>{

    if(
      !validObjectId(
        req.params.id
      )
    ){

      return res
        .status(400)
        .json({
          ok:false,
          error:
            'Invalid Moment ID'
        });

    }


    try{

      const participantId =
        cleanString(
          req.body?.participantId,
          200
        );


      if(
        !participantId
      ){

        return res
          .status(400)
          .json({
            ok:false,
            error:
              'Participant ID is required'
          });

      }


      const moment =
        await MtermsMoment
          .findOne({
            _id:req.params.id,
            isDeleted:false
          });


      if(
        !moment
      ){

        return res
          .status(404)
          .json({
            ok:false,
            error:
              'Moment not found'
          });

      }


      if(
        moment.participantId !==
        participantId
      ){

        return res
          .status(403)
          .json({
            ok:false,
            error:
              'You can only delete your own Moment'
          });

      }


      moment.isDeleted =
        true;


      moment.isVisible =
        false;


      await moment.save();


      /*
        Remove image file to recover storage.
      */

      try{

        await getGridFSBucket()
          .delete(
            moment.imageFileId
          );

      }catch(error){

        console.error(
          'MTERMS Moment GridFS delete warning:',
          error
        );

      }


      res.json({
        ok:true
      });


    }catch(error){

      console.error(
        'MTERMS Moment DELETE error:',
        error
      );


      res
        .status(500)
        .json({
          ok:false,
          error:
            'Unable to delete Moment'
        });

    }

  }
);



/* =====================================================
   ADMIN: GET ALL MOMENTS
===================================================== */

/*
  GET /api/mterms-moments/admin/all
*/

router.get(
  '/admin/all',
  async (
    req,
    res
  )=>{

    try{

      const moments =
        await MtermsMoment
          .find({
            isDeleted:false
          })
          .sort({
            createdAt:-1
          })
          .lean();


      res.json({
        ok:true,

        moments:
          moments.map(
            moment => ({

              ...serialiseMoment(
                moment
              ),

              isVisible:
                moment.isVisible !==
                false

            })
          )
      });


    }catch(error){

      console.error(
        'MTERMS Moments admin GET error:',
        error
      );


      res
        .status(500)
        .json({
          ok:false,
          error:
            'Unable to load admin Moments'
        });

    }

  }
);



/* =====================================================
   ADMIN: HIDE / SHOW MOMENT
===================================================== */

/*
  PATCH
  /api/mterms-moments/admin/:id/visibility

  Body:
  {
    isVisible: true/false
  }
*/

router.patch(
  '/admin/:id/visibility',
  async (
    req,
    res
  )=>{

    if(
      !validObjectId(
        req.params.id
      )
    ){

      return res
        .status(400)
        .json({
          ok:false,
          error:
            'Invalid Moment ID'
        });

    }


    try{

      const isVisible =
        req.body?.isVisible ===
        true;


      const moment =
        await MtermsMoment
          .findOneAndUpdate(

            {
              _id:req.params.id,
              isDeleted:false
            },

            {
              $set:{
                isVisible
              }
            },

            {
              new:true
            }

          );


      if(
        !moment
      ){

        return res
          .status(404)
          .json({
            ok:false,
            error:
              'Moment not found'
          });

      }


      res.json({
        ok:true,
        isVisible:
          moment.isVisible
      });


    }catch(error){

      console.error(
        'MTERMS Moment visibility PATCH error:',
        error
      );


      res
        .status(500)
        .json({
          ok:false,
          error:
            'Unable to update Moment visibility'
        });

    }

  }
);



/* =====================================================
   ADMIN: DELETE MOMENT
===================================================== */

/*
  DELETE
  /api/mterms-moments/admin/:id
*/

router.delete(
  '/admin/:id',
  async (
    req,
    res
  )=>{

    if(
      !validObjectId(
        req.params.id
      )
    ){

      return res
        .status(400)
        .json({
          ok:false,
          error:
            'Invalid Moment ID'
        });

    }


    try{

      const moment =
        await MtermsMoment
          .findOne({
            _id:req.params.id,
            isDeleted:false
          });


      if(
        !moment
      ){

        return res
          .status(404)
          .json({
            ok:false,
            error:
              'Moment not found'
          });

      }


      moment.isDeleted =
        true;


      moment.isVisible =
        false;


      await moment.save();


      try{

        await getGridFSBucket()
          .delete(
            moment.imageFileId
          );

      }catch(error){

        console.error(
          'MTERMS Moment admin GridFS delete warning:',
          error
        );

      }


      res.json({
        ok:true
      });


    }catch(error){

      console.error(
        'MTERMS Moment admin DELETE error:',
        error
      );


      res
        .status(500)
        .json({
          ok:false,
          error:
            'Unable to delete Moment'
        });

    }

  }
);



/* =====================================================
   ADMIN: DELETE COMMENT
===================================================== */

/*
  DELETE
  /api/mterms-moments/admin/:momentId/comments/:commentId
*/

router.delete(
  '/admin/:momentId/comments/:commentId',
  async (
    req,
    res
  )=>{

    if(
      !validObjectId(
        req.params.momentId
      )
    ){

      return res
        .status(400)
        .json({
          ok:false,
          error:
            'Invalid Moment ID'
        });

    }


    try{

      const moment =
        await MtermsMoment
          .findOne({
            _id:
              req.params.momentId,
            isDeleted:false
          });


      if(
        !moment
      ){

        return res
          .status(404)
          .json({
            ok:false,
            error:
              'Moment not found'
          });

      }


      const comment =
        moment.comments.id(
          req.params.commentId
        );


      if(
        !comment ||
        comment.isDeleted
      ){

        return res
          .status(404)
          .json({
            ok:false,
            error:
              'Comment not found'
          });

      }


      comment.isDeleted =
        true;


      await moment.save();


      res.json({
        ok:true
      });


    }catch(error){

      console.error(
        'MTERMS Moment admin comment DELETE error:',
        error
      );


      res
        .status(500)
        .json({
          ok:false,
          error:
            'Unable to delete comment'
        });

    }

  }
);



/* =====================================================
   MULTER ERROR HANDLER
===================================================== */

router.use(
  (
    error,
    req,
    res,
    next
  )=>{

    if(
      error instanceof
      multer.MulterError
    ){

      return res
        .status(400)
        .json({
          ok:false,
          error:
            error.code ===
            'LIMIT_FILE_SIZE'
              ? 'Image is too large'
              : error.message
        });

    }


    if(
      error
    ){

      return res
        .status(400)
        .json({
          ok:false,
          error:
            error.message ||
            'Unable to process image'
        });

    }


    next();

  }
);


module.exports =
  router;
