const express =
  require('express');


const MtermsPresenterFeedback =
  require('../models/MtermsPresenterFeedback');


const router =
  express.Router();



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



/* =====================================================
   HEALTH
===================================================== */

router.get(
  '/health',
  (req,res)=>{

    res.json({
      ok:true,
      service:
        'mterms-presenter-feedback'
    });

  }
);



/* =====================================================
   GET ONE PARTICIPANT'S FEEDBACK FOR ONE PRESENTER
===================================================== */

/*
  GET
  /api/presenter-feedback/:presenterId
    ?participantId=xxxxx
*/

router.get(
  '/:presenterId',
  async (req,res)=>{

    try{

      const presenterId =
        cleanString(
          req.params.presenterId,
          120
        );


      const participantId =
        cleanString(
          req.query.participantId,
          200
        );


      if(
        !presenterId ||
        !participantId
      ){

        return res
          .status(400)
          .json({
            ok:false,
            error:
              'Presenter ID and participant ID are required'
          });

      }


      const feedback =
        await MtermsPresenterFeedback
          .findOne({
            presenterId,
            participantId,
            isDeleted:false
          })
          .lean();


      res.json({
        ok:true,

        feedback:
          feedback
            ? {
                id:
                  String(
                    feedback._id
                  ),

                presenterId:
                  feedback.presenterId,

                sessionId:
                  feedback.sessionId,

                rating:
                  feedback.rating,

                comment:
                  feedback.comment || '',

                createdAt:
                  feedback.createdAt,

                updatedAt:
                  feedback.updatedAt
              }
            : null
      });


    }catch(error){

      console.error(
        'MTERMS presenter feedback GET error:',
        error
      );


      res
        .status(500)
        .json({
          ok:false,
          error:
            'Unable to load presenter feedback'
        });

    }

  }
);



/* =====================================================
   CREATE / UPDATE PRESENTER FEEDBACK
===================================================== */

/*
  PUT
  /api/presenter-feedback/:presenterId

  Body:
  {
    participantId,
    sessionId,
    rating,
    comment
  }

  Always editable.
  One participant/device = one record per presenter.
*/

router.put(
  '/:presenterId',
  async (req,res)=>{

    try{

      const presenterId =
        cleanString(
          req.params.presenterId,
          120
        );


      const participantId =
        cleanString(
          req.body?.participantId,
          200
        );


      const sessionId =
        cleanString(
          req.body?.sessionId,
          120
        );


      const rating =
        Number(
          req.body?.rating
        );


      const comment =
        cleanString(
          req.body?.comment,
          1000
        );


      if(
        !presenterId ||
        !participantId ||
        !sessionId
      ){

        return res
          .status(400)
          .json({
            ok:false,
            error:
              'Presenter ID, participant ID and session ID are required'
          });

      }


      if(
        !Number.isInteger(
          rating
        ) ||
        rating < 1 ||
        rating > 5
      ){

        return res
          .status(400)
          .json({
            ok:false,
            error:
              'Rating must be between 1 and 5'
          });

      }


      const feedback =
        await MtermsPresenterFeedback
          .findOneAndUpdate(
            {
              presenterId,
              participantId
            },

            {
              $set:{
                sessionId,
                rating,
                comment,
                isDeleted:false
              },

              $setOnInsert:{
                presenterId,
                participantId
              }
            },

            {
              new:true,
              upsert:true,
              runValidators:true
            }
          );


      res.json({
        ok:true,

        feedback:{
          id:
            String(
              feedback._id
            ),

          presenterId:
            feedback.presenterId,

          sessionId:
            feedback.sessionId,

          rating:
            feedback.rating,

          comment:
            feedback.comment || '',

          createdAt:
            feedback.createdAt,

          updatedAt:
            feedback.updatedAt
        }
      });


    }catch(error){

      console.error(
        'MTERMS presenter feedback PUT error:',
        error
      );


      if(
        error &&
        error.code === 11000
      ){

        return res
          .status(409)
          .json({
            ok:false,
            error:
              'Duplicate presenter feedback record'
          });

      }


      res
        .status(500)
        .json({
          ok:false,
          error:
            'Unable to save presenter feedback'
        });

    }

  }
);



/* =====================================================
   GET ALL FEEDBACK FOR ADMIN
===================================================== */

/*
  GET
  /api/presenter-feedback/admin/all

  Returns individual feedback records.
  Admin page will aggregate them by presenterId.
*/

router.get(
  '/admin/all',
  async (req,res)=>{

    try{

      const feedback =
        await MtermsPresenterFeedback
          .find({
            isDeleted:false
          })
          .sort({
            updatedAt:-1
          })
          .lean();


      res.json({
        ok:true,

        feedback:
          feedback.map(
            item => ({

              id:
                String(
                  item._id
                ),

              participantId:
                item.participantId,

              presenterId:
                item.presenterId,

              sessionId:
                item.sessionId,

              rating:
                item.rating,

              comment:
                item.comment || '',

              createdAt:
                item.createdAt,

              updatedAt:
                item.updatedAt

            })
          )
      });


    }catch(error){

      console.error(
        'MTERMS presenter feedback admin GET error:',
        error
      );


      res
        .status(500)
        .json({
          ok:false,
          error:
            'Unable to load presenter feedback'
        });

    }

  }
);



/* =====================================================
   GET ADMIN SUMMARY FOR ONE PRESENTER
===================================================== */

/*
  GET
  /api/presenter-feedback/admin/:presenterId
*/

router.get(
  '/admin/:presenterId',
  async (req,res)=>{

    try{

      const presenterId =
        cleanString(
          req.params.presenterId,
          120
        );


      if(!presenterId){

        return res
          .status(400)
          .json({
            ok:false,
            error:
              'Presenter ID is required'
          });

      }


      const feedback =
        await MtermsPresenterFeedback
          .find({
            presenterId,
            isDeleted:false
          })
          .sort({
            updatedAt:-1
          })
          .lean();


      const ratings =
        feedback.map(
          item =>
            Number(
              item.rating
            )
        );


      const total =
        ratings.length;


      const average =
        total
          ? ratings.reduce(
              (sum,value)=>
                sum + value,
              0
            ) / total
          : 0;


      const distribution = {
        5:0,
        4:0,
        3:0,
        2:0,
        1:0
      };


      ratings.forEach(
        rating => {

          if(
            distribution[rating] !==
            undefined
          ){

            distribution[rating]++;

          }

        }
      );


      res.json({
        ok:true,

        presenterId,

        totalResponses:
          total,

        averageRating:
          average,

        distribution,

        comments:
          feedback
            .filter(
              item =>
                item.comment
            )
            .map(
              item => ({
                id:
                  String(
                    item._id
                  ),

                comment:
                  item.comment,

                updatedAt:
                  item.updatedAt
              })
            )
      });


    }catch(error){

      console.error(
        'MTERMS presenter feedback summary GET error:',
        error
      );


      res
        .status(500)
        .json({
          ok:false,
          error:
            'Unable to load presenter feedback summary'
        });

    }

  }
);



/* =====================================================
   ADMIN DELETE / HIDE ONE FEEDBACK RECORD
===================================================== */

/*
  DELETE
  /api/presenter-feedback/admin/:id/delete

  Soft delete only.
*/

router.delete(
  '/admin/:id/delete',
  async (req,res)=>{

    try{

      const feedback =
        await MtermsPresenterFeedback
          .findByIdAndUpdate(
            req.params.id,

            {
              $set:{
                isDeleted:true
              }
            },

            {
              new:true
            }
          );


      if(!feedback){

        return res
          .status(404)
          .json({
            ok:false,
            error:
              'Presenter feedback not found'
          });

      }


      res.json({
        ok:true
      });


    }catch(error){

      console.error(
        'MTERMS presenter feedback delete error:',
        error
      );


      res
        .status(500)
        .json({
          ok:false,
          error:
            'Unable to delete presenter feedback'
        });

    }

  }
);



module.exports =
  router;
