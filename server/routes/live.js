const express = require('express');

const MtermsLiveAnnouncement =
  require('../models/MtermsLiveAnnouncement');

const MtermsLiveMessage =
  require('../models/MtermsLiveMessage');

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


/* =====================================================
   DISCUSSIONS
===================================================== */


/*
  GET /api/live/messages
  GET /api/live/messages?sessionId=d1-s2

  Without sessionId:
  returns all active MTERMS Live discussion posts.

  With sessionId:
  returns posts for one discussion room.
*/

router.get('/messages', async (req, res) => {

  try {

    const sessionId =
      String(req.query.sessionId || '')
        .trim()
        .slice(0, 120);

    const filter = {
      isDeleted: false
    };

    if (sessionId) {
      filter.sessionId = sessionId;
    }

    const messages =
      await MtermsLiveMessage
        .find(filter)
        .sort({
          createdAt: -1
        })
        .lean();

    res.json({
      ok: true,

      messages:
        messages.map(item => ({
          id: String(item._id),

          sessionId:
            item.sessionId,

          author:
            item.author,

          title:
            item.title || '',

          affiliation:
            item.affiliation || '',

          type:
            item.messageType,

          message:
            item.message,

          likes:
            Number(item.likes || 0),

          likedBy:
            Array.isArray(item.likedBy)
              ? item.likedBy
              : [],

          participantId:
            item.participantId || '',

          createdAt:
            item.createdAt,

          replies:
            (item.replies || []).map(reply => ({
              id: String(reply._id),

              author:
                reply.author,

              title:
                reply.title || '',

              affiliation:
                reply.affiliation || '',

              message:
                reply.message,

              participantId:
                reply.participantId || '',

              createdAt:
                reply.createdAt
            }))
        }))
    });

  } catch (error) {

    console.error(
      'MTERMS Live messages GET error:',
      error
    );

    res.status(500).json({
      ok: false,
      error: 'Unable to load discussions'
    });

  }

});


/*
  POST /api/live/messages

  Create a new main discussion topic/question.
*/

router.post('/messages', async (req, res) => {

  try {

    const sessionId =
      String(req.body?.sessionId || '')
        .trim()
        .slice(0, 120);

    const author =
      String(req.body?.author || '')
        .trim()
        .slice(0, 50);

    const title =
      String(req.body?.title || '')
        .trim()
        .slice(0, 30);

    const affiliation =
      String(req.body?.affiliation || '')
        .trim()
        .slice(0, 80);

    const message =
      String(req.body?.message || '')
        .trim()
        .slice(0, 1000);

    const participantId =
      String(req.body?.participantId || '')
        .trim()
        .slice(0, 200);

    const messageType =
      req.body?.type === 'Question'
        ? 'Question'
        : 'Discussion';


    if (!sessionId) {

      return res.status(400).json({
        ok: false,
        error: 'Session ID is required'
      });

    }


    if (!author) {

      return res.status(400).json({
        ok: false,
        error: 'Display name is required'
      });

    }


    if (!message) {

      return res.status(400).json({
        ok: false,
        error: 'Message is required'
      });

    }


    const created =
      await MtermsLiveMessage.create({
        sessionId,
        author,
        title,
        affiliation,
        messageType,
        message,
        participantId,
        likes: 0,
        likedBy: [],
        replies: [],
        isDeleted: false
      });


    res.status(201).json({
      ok: true,
      id: String(created._id)
    });

  } catch (error) {

    console.error(
      'MTERMS Live message POST error:',
      error
    );

    res.status(500).json({
      ok: false,
      error: 'Unable to post message'
    });

  }

});


/*
  POST /api/live/messages/:id/replies

  Add a threaded reply.
*/

router.post(
  '/messages/:id/replies',
  async (req, res) => {

    try {

      const author =
        String(req.body?.author || '')
          .trim()
          .slice(0, 50);

      const title =
        String(req.body?.title || '')
          .trim()
          .slice(0, 30);

      const affiliation =
        String(req.body?.affiliation || '')
          .trim()
          .slice(0, 80);

      const message =
        String(req.body?.message || '')
          .trim()
          .slice(0, 1000);

      const participantId =
        String(req.body?.participantId || '')
          .trim()
          .slice(0, 200);


      if (!author || !message) {

        return res.status(400).json({
          ok: false,
          error: 'Name and reply are required'
        });

      }


      const post =
        await MtermsLiveMessage.findOne({
          _id: req.params.id,
          isDeleted: false
        });


      if (!post) {

        return res.status(404).json({
          ok: false,
          error: 'Discussion post not found'
        });

      }


      post.replies.push({
        author,
        title,
        affiliation,
        message,
        participantId,
        createdAt: new Date()
      });


      await post.save();


      const createdReply =
        post.replies[
          post.replies.length - 1
        ];


      res.status(201).json({
        ok: true,
        replyId:
          String(createdReply._id)
      });

    } catch (error) {

      console.error(
        'MTERMS Live reply POST error:',
        error
      );

      res.status(500).json({
        ok: false,
        error: 'Unable to post reply'
      });

    }

  }
);


/*
  POST /api/live/messages/:id/like

  Toggle like for one participant/device.
*/

router.post(
  '/messages/:id/like',
  async (req, res) => {

    try {

      const participantId =
        String(
          req.body?.participantId || ''
        )
          .trim()
          .slice(0, 200);


      if (!participantId) {

        return res.status(400).json({
          ok: false,
          error: 'Participant ID is required'
        });

      }


      const post =
        await MtermsLiveMessage.findOne({
          _id: req.params.id,
          isDeleted: false
        });


      if (!post) {

        return res.status(404).json({
          ok: false,
          error: 'Discussion post not found'
        });

      }


      if (!Array.isArray(post.likedBy)) {
        post.likedBy = [];
      }


      const alreadyLiked =
        post.likedBy.includes(
          participantId
        );


      if (alreadyLiked) {

        post.likedBy =
          post.likedBy.filter(
            id =>
              id !== participantId
          );

      } else {

        post.likedBy.push(
          participantId
        );

      }


      post.likes =
        post.likedBy.length;


      await post.save();


      res.json({
        ok: true,

        liked:
          !alreadyLiked,

        likes:
          post.likes
      });

    } catch (error) {

      console.error(
        'MTERMS Live like error:',
        error
      );

      res.status(500).json({
        ok: false,
        error: 'Unable to update like'
      });

    }

  }
);


module.exports = router;


