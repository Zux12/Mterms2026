const express = require('express');

const MtermsLiveAnnouncement =
  require('../models/MtermsLiveAnnouncement');

const MtermsLiveMessage =
  require('../models/MtermsLiveMessage');

const MtermsLiveFeedback =
  require('../models/MtermsLiveFeedback');

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


/* =====================================================
   ADMIN MODERATION
===================================================== */


/*
  DELETE /api/live/messages/:id

  Soft-delete a main discussion post.
*/

router.delete(
  '/messages/:id',
  async (req, res) => {

    try {

      const post =
        await MtermsLiveMessage
          .findByIdAndUpdate(
            req.params.id,
            {
              $set: {
                isDeleted: true
              }
            },
            {
              new: true
            }
          );


      if (!post) {

        return res.status(404).json({
          ok: false,
          error: 'Discussion post not found'
        });

      }


      res.json({
        ok: true
      });

    } catch (error) {

      console.error(
        'MTERMS Live post DELETE error:',
        error
      );

      res.status(500).json({
        ok: false,
        error: 'Unable to delete post'
      });

    }

  }
);


/*
  DELETE /api/live/messages/:id/replies/:replyId

  Remove one reply from a thread.
*/

router.delete(
  '/messages/:id/replies/:replyId',
  async (req, res) => {

    try {

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


      const before =
        post.replies.length;


      post.replies =
        post.replies.filter(
          reply =>
            String(reply._id) !==
            String(req.params.replyId)
        );


      if (
        post.replies.length === before
      ) {

        return res.status(404).json({
          ok: false,
          error: 'Reply not found'
        });

      }


      await post.save();


      res.json({
        ok: true
      });

    } catch (error) {

      console.error(
        'MTERMS Live reply DELETE error:',
        error
      );

      res.status(500).json({
        ok: false,
        error: 'Unable to delete reply'
      });

    }

  }
);


/* =====================================================
   SESSION FEEDBACK
===================================================== */


/*
  GET /api/live/feedback/session/:sessionId

  Returns this participant/device's feedback
  for one session, if it exists.
*/

router.get(
  '/feedback/session/:sessionId',
  async (req, res) => {

    try {

      const sessionId =
        String(req.params.sessionId || '')
          .trim()
          .slice(0, 120);

      const participantId =
        String(req.query.participantId || '')
          .trim()
          .slice(0, 200);


      if (!sessionId || !participantId) {

        return res.status(400).json({
          ok: false,
          error: 'Session ID and participant ID are required'
        });

      }


      const feedback =
        await MtermsLiveFeedback
          .findOne({
            feedbackType: 'session',
            sessionId,
            participantId
          })
          .lean();


      res.json({
        ok: true,
        feedback: feedback
          ? {
              id: String(feedback._id),
              sessionId: feedback.sessionId,
              rating: feedback.rating,
              comment: feedback.comment || '',
              updatedAt: feedback.updatedAt
            }
          : null
      });

    } catch (error) {

      console.error(
        'MTERMS Live session feedback GET error:',
        error
      );

      res.status(500).json({
        ok: false,
        error: 'Unable to load session feedback'
      });

    }

  }
);


/*
  PUT /api/live/feedback/session/:sessionId

  Create or update one feedback response
  per participant/device per session.
*/

router.put(
  '/feedback/session/:sessionId',
  async (req, res) => {

    try {

      const sessionId =
        String(req.params.sessionId || '')
          .trim()
          .slice(0, 120);

      const participantId =
        String(req.body?.participantId || '')
          .trim()
          .slice(0, 200);

      const rating =
        Number(req.body?.rating);

      const comment =
        String(req.body?.comment || '')
          .trim()
          .slice(0, 1000);


      if (!sessionId || !participantId) {

        return res.status(400).json({
          ok: false,
          error: 'Session ID and participant ID are required'
        });

      }


      if (
        !Number.isInteger(rating) ||
        rating < 1 ||
        rating > 5
      ) {

        return res.status(400).json({
          ok: false,
          error: 'Rating must be between 1 and 5'
        });

      }


      const feedback =
        await MtermsLiveFeedback
          .findOneAndUpdate(
            {
              feedbackType: 'session',
              sessionId,
              participantId
            },
            {
              $set: {
                rating,
                comment
              },
              $setOnInsert: {
                feedbackType: 'session',
                sessionId,
                participantId
              }
            },
            {
              new: true,
              upsert: true,
              runValidators: true
            }
          );


      res.json({
        ok: true,
        feedback: {
          id: String(feedback._id),
          sessionId: feedback.sessionId,
          rating: feedback.rating,
          comment: feedback.comment || '',
          updatedAt: feedback.updatedAt
        }
      });

    } catch (error) {

      console.error(
        'MTERMS Live session feedback PUT error:',
        error
      );

      res.status(500).json({
        ok: false,
        error: 'Unable to save session feedback'
      });

    }

  }
);


/*
  GET /api/live/feedback/sessions

  Admin summary for all session feedback.
*/

router.get(
  '/feedback/sessions',
  async (req, res) => {

    try {

      const feedback =
        await MtermsLiveFeedback
          .find({
            feedbackType: 'session'
          })
          .sort({
            createdAt: -1
          })
          .lean();


      res.json({
        ok: true,
        feedback:
          feedback.map(item => ({
            id: String(item._id),
            sessionId: item.sessionId,
            rating: item.rating,
            comment: item.comment || '',
            createdAt: item.createdAt,
            updatedAt: item.updatedAt
          }))
      });

    } catch (error) {

      console.error(
        'MTERMS Live session feedback admin GET error:',
        error
      );

      res.status(500).json({
        ok: false,
        error: 'Unable to load session feedback'
      });

    }

  }
);


module.exports = router;


