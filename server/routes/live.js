const express = require('express');

const MtermsLiveAnnouncement =
  require('../models/MtermsLiveAnnouncement');

const router = express.Router();


/* =====================================================
   HEALTH
===================================================== */

router.get('/health', (req, res) => {

  res.json({
    ok: true,
    service: 'mterms-live'
  });

});


/* =====================================================
   ANNOUNCEMENTS
===================================================== */


/*
  GET /api/live/announcements

  Public endpoint.
  Participant page uses this to retrieve
  currently published announcements.
*/

router.get('/announcements', async (req, res) => {

  try {

    const announcements =
      await MtermsLiveAnnouncement
        .find({
          isActive: true
        })
        .sort({
          publishedAt: -1
        })
        .lean();

    res.json({
      ok: true,

      announcements:
        announcements.map(item => ({
          id: String(item._id),
          message: item.message,
          important: item.important,
          publishedAt: item.publishedAt
        }))
    });

  } catch (error) {

    console.error(
      'MTERMS Live announcements GET error:',
      error
    );

    res.status(500).json({
      ok: false,
      error: 'Unable to load announcements'
    });

  }

});


/*
  POST /api/live/announcements

  Admin creates an announcement.

  NOTE:
  Admin authentication will be added
  before production launch.
*/

router.post('/announcements', async (req, res) => {

  try {

    const message =
      String(
        req.body?.message || ''
      )
        .trim()
        .slice(0, 1000);

    const important =
      req.body?.important === true;


    if (!message) {

      return res.status(400).json({
        ok: false,
        error: 'Announcement message is required'
      });

    }


    const announcement =
      await MtermsLiveAnnouncement.create({
        message,
        important,
        isActive: true,
        publishedAt: new Date()
      });


    res.status(201).json({
      ok: true,

      announcement: {
        id: String(announcement._id),
        message: announcement.message,
        important: announcement.important,
        publishedAt: announcement.publishedAt
      }
    });

  } catch (error) {

    console.error(
      'MTERMS Live announcements POST error:',
      error
    );

    res.status(500).json({
      ok: false,
      error: 'Unable to publish announcement'
    });

  }

});


/*
  DELETE /api/live/announcements/:id

  We intentionally use a SOFT DELETE.

  The MongoDB document is retained.
  Only isActive becomes false.

  This is safer than permanently deleting
  conference records.
*/

router.delete(
  '/announcements/:id',
  async (req, res) => {

    try {

      const announcement =
        await MtermsLiveAnnouncement
          .findByIdAndUpdate(
            req.params.id,
            {
              $set: {
                isActive: false
              }
            },
            {
              new: true
            }
          );


      if (!announcement) {

        return res.status(404).json({
          ok: false,
          error: 'Announcement not found'
        });

      }


      res.json({
        ok: true
      });

    } catch (error) {

      console.error(
        'MTERMS Live announcement DELETE error:',
        error
      );

      res.status(500).json({
        ok: false,
        error: 'Unable to delete announcement'
      });

    }

  }
);


module.exports = router;
