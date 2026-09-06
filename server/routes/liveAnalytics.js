const express =
  require('express');


const MtermsLiveAnalyticsEvent =
  require('../models/MtermsLiveAnalyticsEvent');


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



function detectDeviceType(
  userAgent
){

  const ua =
    String(
      userAgent || ''
    )
    .toLowerCase();


  if(
    /ipad|tablet/.test(
      ua
    )
  ){

    return 'Tablet';

  }


  if(
    /iphone|android|mobile/.test(
      ua
    )
  ){

    return 'Mobile';

  }


  return 'Desktop';

}



function detectBrowser(
  userAgent
){

  const ua =
    String(
      userAgent || ''
    );


  if(
    /Edg\//.test(
      ua
    )
  ){

    return 'Edge';

  }


  if(
    /CriOS\//.test(
      ua
    )
  ){

    return 'Chrome iOS';

  }


  if(
    /Chrome\//.test(
      ua
    )
  ){

    return 'Chrome';

  }


  if(
    /FxiOS\//.test(
      ua
    )
  ){

    return 'Firefox iOS';

  }


  if(
    /Firefox\//.test(
      ua
    )
  ){

    return 'Firefox';

  }


  if(
    /Safari\//.test(
      ua
    ) &&
    /Version\//.test(
      ua
    )
  ){

    return 'Safari';

  }


  return 'Other';

}



function detectOS(
  userAgent
){

  const ua =
    String(
      userAgent || ''
    );


  if(
    /iPhone|iPad|iPod/.test(
      ua
    )
  ){

    return 'iOS';

  }


  if(
    /Android/.test(
      ua
    )
  ){

    return 'Android';

  }


  if(
    /Macintosh|Mac OS X/.test(
      ua
    )
  ){

    return 'macOS';

  }


  if(
    /Windows/.test(
      ua
    )
  ){

    return 'Windows';

  }


  if(
    /Linux/.test(
      ua
    )
  ){

    return 'Linux';

  }


  return 'Other';

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
        'mterms-live-analytics'
    });

  }
);



/* =====================================================
   LOG EVENT
===================================================== */

/*
  POST /api/live-analytics/event

  Body:
  {
    participantId,
    event,
    page,
    targetId,
    targetType,
    metadata
  }
*/

router.post(
  '/event',
  async (req,res)=>{

    try{

      const participantId =
        cleanString(
          req.body?.participantId,
          200
        );


      const event =
        cleanString(
          req.body?.event,
          80
        );


      const page =
        cleanString(
          req.body?.page,
          80
        );


      const targetId =
        cleanString(
          req.body?.targetId,
          160
        );


      const targetType =
        cleanString(
          req.body?.targetType,
          80
        );


      if(
        !participantId ||
        !event
      ){

        return res
          .status(400)
          .json({
            ok:false,
            error:
              'Participant ID and event are required'
          });

      }


      const userAgent =
        cleanString(
          req.headers[
            'user-agent'
          ],
          500
        );


      const analyticsEvent =
        await MtermsLiveAnalyticsEvent
          .create({

            participantId,

            event,

            page,

            targetId,

            targetType,

            deviceType:
              detectDeviceType(
                userAgent
              ),

            browser:
              detectBrowser(
                userAgent
              ),

            os:
              detectOS(
                userAgent
              ),

            userAgent,

            metadata:
              (
                req.body &&
                typeof req.body.metadata ===
                'object' &&
                req.body.metadata !== null
              )
                ? req.body.metadata
                : {}

          });


      res.status(201)
        .json({

          ok:true,

          id:
            String(
              analyticsEvent._id
            )

        });


    }catch(error){

      console.error(
        'MTERMS Live Analytics POST error:',
        error
      );


      res
        .status(500)
        .json({
          ok:false,
          error:
            'Unable to record analytics event'
        });

    }

  }
);



/* =====================================================
   ADMIN — RAW EVENTS
===================================================== */

router.get(
  '/admin/events',
  async (req,res)=>{

    try{

      const limit =
        Math.min(
          Math.max(
            Number(
              req.query.limit ||
              5000
            ),
            1
          ),
          20000
        );


      const events =
        await MtermsLiveAnalyticsEvent
          .find({})
          .sort({
            createdAt:-1
          })
          .limit(
            limit
          )
          .lean();


      res.json({

        ok:true,

        events:
          events.map(
            item => ({

              id:
                String(
                  item._id
                ),

              participantId:
                item.participantId,

              event:
                item.event,

              page:
                item.page || '',

              targetId:
                item.targetId || '',

              targetType:
                item.targetType || '',

              deviceType:
                item.deviceType || '',

              browser:
                item.browser || '',

              os:
                item.os || '',

              metadata:
                item.metadata || {},

              createdAt:
                item.createdAt

            })
          )

      });


    }catch(error){

      console.error(
        'MTERMS Live Analytics admin GET error:',
        error
      );


      res
        .status(500)
        .json({
          ok:false,
          error:
            'Unable to load analytics events'
        });

    }

  }
);



module.exports =
  router;
