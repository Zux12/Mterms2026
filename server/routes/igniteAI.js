// server/routes/igniteAI.js

const express = require('express');

const Registration = require('../models/Registration');
const AbstractReview = require('../models/AbstractReview');

const { extractAbstractText } = require('../services/abstractText');
const { assessAbstract } = require('../services/igniteAI');

const router = express.Router();

/* =========================================================
   ADMIN AUTHENTICATION
   Uses the same Basic authentication as admin.html
   ========================================================= */

function adminAuth(req, res, next) {
  const header = String(req.headers.authorization || '');

  if (!header.startsWith('Basic ')) {
    return res.status(401).json({
      error: 'Admin login required.'
    });
  }

  try {
    const raw = Buffer.from(
      header.slice(6),
      'base64'
    ).toString('utf8');

    const separatorIndex = raw.indexOf(':');

    const username =
      separatorIndex >= 0
        ? raw.slice(0, separatorIndex)
        : raw;

    const password =
      separatorIndex >= 0
        ? raw.slice(separatorIndex + 1)
        : '';

    if (
      username === 'admin' &&
      password === 'admin'
    ) {
      return next();
    }

    return res.status(401).json({
      error: 'Invalid admin credentials.'
    });
  } catch (err) {
    return res.status(401).json({
      error: 'Invalid admin authorization.'
    });
  }
}

/* =========================================================
   ABSTRACT AND ASSESSMENT HELPERS
   ========================================================= */

function pickLatestAbstract(uploads) {
  const abstracts = Array.isArray(uploads)
    ? uploads.filter(row => row?.type === 'abstract')
    : [];

  if (!abstracts.length) return null;

  return abstracts
    .slice()
    .sort((a, b) => {
      const versionA = Number(a?.version || 0);
      const versionB = Number(b?.version || 0);

      if (versionB !== versionA) {
        return versionB - versionA;
      }

      const timeA = new Date(
        a?.uploadedAt || 0
      ).getTime();

      const timeB = new Date(
        b?.uploadedAt || 0
      ).getTime();

      return timeB - timeA;
    })[0];
}

function getAssessments(registration) {
  return Array.isArray(
    registration?.igniteAIAssessments
  )
    ? registration.igniteAIAssessments
    : [];
}

function getAssessmentForAbstract(
  registration,
  abstractRecord
) {
  if (!abstractRecord?.gridFsId) {
    return null;
  }

  const gridFsId = String(
    abstractRecord.gridFsId
  );

  return (
    getAssessments(registration).find(
      assessment =>
        String(
          assessment?.abstractGridFsId || ''
        ) === gridFsId
    ) || null
  );
}

function getLatestAssessment(registration) {
  const assessments =
    getAssessments(registration);

  if (!assessments.length) {
    return null;
  }

  return assessments
    .slice()
    .sort((a, b) => {
      const timeA = new Date(
        a?.assessedAt || 0
      ).getTime();

      const timeB = new Date(
        b?.assessedAt || 0
      ).getTime();

      return timeB - timeA;
    })[0];
}

function serializeAbstract(row) {
  if (!row) return null;

  return {
    version: Number(row.version || 0),
    gridFsId: String(row.gridFsId || ''),
    filename: row.filename || '',
    size: Number(row.size || 0),
    contentType: row.contentType || '',
    uploadedAt: row.uploadedAt || null
  };
}

function serializeAssessment(row) {
  if (!row) return null;

  return {
    assessmentId: row.assessmentId || '',
    status: row.status || 'completed',

    abstractVersion:
      Number(row.abstractVersion || 0),

    abstractGridFsId:
      String(row.abstractGridFsId || ''),

    abstractFilename:
      row.abstractFilename || '',

    abstractContentType:
      row.abstractContentType || '',

    abstractUploadedAt:
      row.abstractUploadedAt || null,

    scores: row.scores || {},

    scoreJustifications:
      row.scoreJustifications || {},

    requireCorrection:
      row.requireCorrection || '',

    correctionReasons:
      row.correctionReasons || {},

    recommendedCategory:
      row.recommendedCategory || '',

    model: row.model || '',

    rubricVersion:
      row.rubricVersion || '',

    assessedAt:
      row.assessedAt || null
  };
}

function makeAssessmentId() {
  const timestamp = Date.now();

  const randomPart = Math.random()
    .toString(36)
    .slice(2, 8)
    .toUpperCase();

  return (
    `IGN-AI-2026-${timestamp}-` +
    randomPart
  );
}

function participantSummary(registration) {
  const latestAbstract =
    pickLatestAbstract(registration?.uploads);

  const currentAssessment =
    getAssessmentForAbstract(
      registration,
      latestAbstract
    );

  const latestAssessment =
    getLatestAssessment(registration);

  const participantName = [
    registration?.personal?.firstName || '',
    registration?.personal?.lastName || ''
  ]
    .join(' ')
    .trim();

  const newAbstractDetected =
    !!latestAbstract &&
    !!latestAssessment &&
    !currentAssessment;

  return {
    registrationId:
      String(registration?._id || ''),

    regCode:
      registration?.regCode || '',

    participantName,

    affiliation:
      registration?.professional
        ?.affiliation || '',

    title:
      registration?.submission?.title || '',

    theme:
      registration?.submission?.theme || '',

    field:
      registration?.submission?.field || '',

    presentationType:
      registration?.program?.type || '',

    latestAbstract:
      serializeAbstract(latestAbstract),

    currentAssessment:
      serializeAssessment(currentAssessment),

    latestAssessment:
      serializeAssessment(latestAssessment),

    newAbstractDetected,

    igniteStatus: currentAssessment
      ? 'completed'
      : latestAbstract
        ? 'available'
        : 'no-abstract'
  };
}

/* =========================================================
   READINESS CHECK
   ========================================================= */

async function checkReadiness(registration) {
  const latestAbstract =
    pickLatestAbstract(registration?.uploads);

  const currentAssessment =
    getAssessmentForAbstract(
      registration,
      latestAbstract
    );

  const checks = {
    participantRecordLoaded:
      !!registration,

    registrationCodeAvailable:
      !!String(
        registration?.regCode || ''
      ).trim(),

    abstractTitleAvailable:
      !!String(
        registration?.submission?.title || ''
      ).trim(),

    themeAvailable:
      !!String(
        registration?.submission?.theme || ''
      ).trim(),

    fieldAvailable:
      !!String(
        registration?.submission?.field || ''
      ).trim(),

    presentationPreferenceAvailable:
      !!String(
        registration?.program?.type || ''
      ).trim(),

    latestAbstractFound:
      !!latestAbstract,

    abstractFileIdAvailable:
      !!latestAbstract?.gridFsId,

    abstractTextExtracted:
      false,

    reviewerRubricLoaded:
      true,

    openAIKeyConfigured:
      !!String(
        process.env.OPENAI_API_KEY || ''
      ).trim(),

    igniteAIModelConfigured:
      !!String(
        process.env.IGNITE_AI_MODEL || ''
      ).trim(),

    currentAbstractNotAlreadyAssessed:
      !currentAssessment
  };

  let extracted = null;
  let failureReason = '';

  if (!latestAbstract) {
    failureReason =
      'No abstract has been uploaded for this participant.';
  } else if (!latestAbstract.gridFsId) {
    failureReason =
      'The latest abstract file ID is missing.';
  } else if (currentAssessment) {
    failureReason =
      'The current abstract has already been assessed by Ignite AI™.';
  } else {
    try {
      extracted = await extractAbstractText({
        gridFsId:
          latestAbstract.gridFsId,

        filename:
          latestAbstract.filename,

        contentType:
          latestAbstract.contentType
      });

      checks.abstractTextExtracted =
        !!extracted?.text &&
        Number(
          extracted?.characterCount || 0
        ) >= 100;
    } catch (err) {
      failureReason =
        err?.message ||
        'The abstract text could not be extracted.';
    }
  }

  const ready =
    Object.values(checks).every(Boolean);

  if (!ready && !failureReason) {
    if (
      !checks.registrationCodeAvailable
    ) {
      failureReason =
        'The participant registration code is missing.';
    } else if (
      !checks.abstractTitleAvailable
    ) {
      failureReason =
        'The abstract title is missing.';
    } else if (
      !checks.themeAvailable
    ) {
      failureReason =
        'The abstract theme is missing.';
    } else if (
      !checks.fieldAvailable
    ) {
      failureReason =
        'The abstract field is missing.';
    } else if (
      !checks.presentationPreferenceAvailable
    ) {
      failureReason =
        'The presentation preference is missing.';
    } else if (
      !checks.openAIKeyConfigured
    ) {
      failureReason =
        'The OpenAI API key is not configured.';
    } else if (
      !checks.igniteAIModelConfigured
    ) {
      failureReason =
        'The Ignite AI model is not configured.';
    } else {
      failureReason =
        'Ignite AI™ is not ready for this assessment.';
    }
  }

  return {
    ready,
    checks,
    failureReason,
    latestAbstract,
    currentAssessment,
    extracted
  };
}

/* =========================================================
   COMPARISON HELPERS
   ========================================================= */

function getOverallQuality(score) {
  const value = Number(score || 0);

  if (value >= 30) return 'Excellent';
  if (value >= 25) return 'Strong';
  if (value >= 20) return 'Adequate';
  if (value >= 15) return 'Weak';

  return 'Poor';
}

function compareReviews(
  humanReview,
  igniteAssessment
) {
  if (
    !humanReview ||
    humanReview.status !== 'submitted'
  ) {
    return {
      available: false,
      reason:
        'The human reviewer has not submitted a final review.'
    };
  }

  if (!igniteAssessment) {
    return {
      available: false,
      reason:
        'Ignite AI™ has not completed an assessment for the current abstract.'
    };
  }

  const human =
    humanReview.scores || {};

  const ai =
    igniteAssessment.scores || {};

  const humanTotal =
    Number(human.total || 0);

  const aiTotal =
    Number(ai.total || 0);

  const average =
    Number(
      (
        (humanTotal + aiTotal) /
        2
      ).toFixed(1)
    );

  const totalDifference =
    aiTotal - humanTotal;

  return {
    available: true,

    criteria: {
      introductionObjective: {
        human:
          Number(
            human.introductionObjective || 0
          ),

        igniteAI:
          Number(
            ai.introductionObjective || 0
          ),

        difference:
          Number(
            ai.introductionObjective || 0
          ) -
          Number(
            human.introductionObjective || 0
          )
      },

      materialsMethods: {
        human:
          Number(
            human.materialsMethods || 0
          ),

        igniteAI:
          Number(
            ai.materialsMethods || 0
          ),

        difference:
          Number(
            ai.materialsMethods || 0
          ) -
          Number(
            human.materialsMethods || 0
          )
      },

      results: {
        human:
          Number(human.results || 0),

        igniteAI:
          Number(ai.results || 0),

        difference:
          Number(ai.results || 0) -
          Number(human.results || 0)
      },

      conclusion: {
        human:
          Number(
            human.conclusion || 0
          ),

        igniteAI:
          Number(
            ai.conclusion || 0
          ),

        difference:
          Number(
            ai.conclusion || 0
          ) -
          Number(
            human.conclusion || 0
          )
      },

      significanceImplication: {
        human:
          Number(
            human.significanceImplication ||
            0
          ),

        igniteAI:
          Number(
            ai.significanceImplication ||
            0
          ),

        difference:
          Number(
            ai.significanceImplication ||
            0
          ) -
          Number(
            human.significanceImplication ||
            0
          )
      }
    },

    totals: {
      human: humanTotal,
      igniteAI: aiTotal,
      difference: totalDifference,
      average
    },

    decisions: {
      humanRequireCorrection:
        humanReview.requireCorrection || '',

      igniteAIRequireCorrection:
        igniteAssessment
          .requireCorrection || '',

      humanRecommendedCategory:
        humanReview
          .recommendedCategory || '',

      igniteAIRecommendedCategory:
        igniteAssessment
          .recommendedCategory || ''
    },

    overallQuality:
      getOverallQuality(average),

    assessmentConsistency:
      Math.abs(totalDifference) <= 2
        ? 'High'
        : Math.abs(totalDifference) <= 5
          ? 'Moderate'
          : 'Low'
  };
}

/* =========================================================
   GET PARTICIPANT LIST
   GET /api/ignite-ai/participants
   ========================================================= */

router.get(
  '/participants',
  adminAuth,
  async (req, res) => {
    try {
      const q =
        String(req.query.q || '').trim();

      const page =
        Math.max(
          1,
          Number(req.query.page || 1)
        );

      const limit =
        Math.min(
          100,
          Math.max(
            1,
            Number(req.query.limit || 20)
          )
        );

      const filter = {
        'program.presenting': true
      };

      if (q) {
        filter.$or = [
          {
            regCode:
              new RegExp(q, 'i')
          },
          {
            'personal.firstName':
              new RegExp(q, 'i')
          },
          {
            'personal.lastName':
              new RegExp(q, 'i')
          },
          {
            'personal.email':
              new RegExp(q, 'i')
          },
          {
            'professional.affiliation':
              new RegExp(q, 'i')
          },
          {
            'submission.title':
              new RegExp(q, 'i')
          }
        ];
      }

      const [registrations, total] =
        await Promise.all([
          Registration.find(filter)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(),

          Registration.countDocuments(
            filter
          )
        ]);

      return res.json({
        ok: true,

        rows:
          registrations.map(
            participantSummary
          ),

        total,
        page,
        limit
      });
    } catch (err) {
      console.error(
        'Ignite AI participant list error:',
        err
      );

      return res.status(500).json({
        error:
          'Failed to load Ignite AI participants.'
      });
    }
  }
);

/* =========================================================
   CHECK READINESS
   GET /api/ignite-ai/readiness/:registrationId
   ========================================================= */

router.get(
  '/readiness/:registrationId',
  adminAuth,
  async (req, res) => {
    try {
      const registration =
        await Registration.findById(
          req.params.registrationId
        );

      if (!registration) {
        return res.status(404).json({
          error:
            'Participant registration not found.'
        });
      }

      const readiness =
        await checkReadiness(
          registration
        );

      return res.json({
        ok: true,

        participant:
          participantSummary(
            registration.toObject()
          ),

        ready:
          readiness.ready,

        checks:
          readiness.checks,

        failureReason:
          readiness.failureReason,

        extractedTextInfo:
          readiness.extracted
            ? {
                characterCount:
                  readiness.extracted
                    .characterCount,

                wordCount:
                  readiness.extracted
                    .wordCount
              }
            : null,

        currentAssessment:
          serializeAssessment(
            readiness.currentAssessment
          )
      });
    } catch (err) {
      console.error(
        'Ignite AI readiness error:',
        err
      );

      return res.status(500).json({
        error:
          err?.message ||
          'Failed to check Ignite AI readiness.'
      });
    }
  }
);

/* =========================================================
   START AI ASSESSMENT
   POST /api/ignite-ai/assess/:registrationId
   ========================================================= */

router.post(
  '/assess/:registrationId',
  adminAuth,
  async (req, res) => {
    try {
      const registration =
        await Registration.findById(
          req.params.registrationId
        );

      if (!registration) {
        return res.status(404).json({
          error:
            'Participant registration not found.'
        });
      }

      const readiness =
        await checkReadiness(
          registration
        );

      if (!readiness.ready) {
        return res.status(400).json({
          error:
            readiness.failureReason ||
            'Ignite AI™ is not ready.',

          checks:
            readiness.checks
        });
      }

      const latestAbstract =
        readiness.latestAbstract;

      const extracted =
        readiness.extracted;

      const aiResult =
        await assessAbstract({
          title:
            registration
              ?.submission?.title || '',

          theme:
            registration
              ?.submission?.theme || '',

          field:
            registration
              ?.submission?.field || '',

          presentationType:
            registration
              ?.program?.type || '',

          abstractText:
            extracted.text
        });

      const assessment = {
        assessmentId:
          makeAssessmentId(),

        status:
          'completed',

        abstractVersion:
          Number(
            latestAbstract.version || 0
          ),

        abstractGridFsId:
          latestAbstract.gridFsId,

        abstractFilename:
          latestAbstract.filename || '',

        abstractContentType:
          latestAbstract.contentType || '',

        abstractUploadedAt:
          latestAbstract.uploadedAt ||
          null,

        scores:
          aiResult.scores,

        scoreJustifications:
          aiResult.scoreJustifications,

        requireCorrection:
          aiResult.requireCorrection,

        correctionReasons:
          aiResult.correctionReasons,

        recommendedCategory:
          aiResult.recommendedCategory,

        model:
          aiResult.model,

        rubricVersion:
          aiResult.rubricVersion,

        assessedAt:
          new Date()
      };

      registration
        .igniteAIAssessments.push(
          assessment
        );

      await registration.save();

      const savedAssessment =
        getAssessmentForAbstract(
          registration,
          latestAbstract
        );

      return res.status(201).json({
        ok: true,

        message:
          'Ignite AI™ assessment completed and saved successfully.',

        assessment:
          serializeAssessment(
            savedAssessment
          )
      });
    } catch (err) {
      console.error(
        'Ignite AI assessment error:',
        err
      );

      return res.status(500).json({
        error:
          err?.message ||
          'Ignite AI™ assessment failed. No assessment was saved.'
      });
    }
  }
);

/* =========================================================
   GET SAVED AI RESULT
   GET /api/ignite-ai/result/:registrationId
   ========================================================= */

router.get(
  '/result/:registrationId',
  adminAuth,
  async (req, res) => {
    try {
      const registration =
        await Registration.findById(
          req.params.registrationId
        ).lean();

      if (!registration) {
        return res.status(404).json({
          error:
            'Participant registration not found.'
        });
      }

      const latestAbstract =
        pickLatestAbstract(
          registration.uploads
        );

      const currentAssessment =
        getAssessmentForAbstract(
          registration,
          latestAbstract
        );

      return res.json({
        ok: true,

        participant:
          participantSummary(
            registration
          ),

        currentAssessment:
          serializeAssessment(
            currentAssessment
          )
      });
    } catch (err) {
      console.error(
        'Ignite AI result error:',
        err
      );

      return res.status(500).json({
        error:
          'Failed to load Ignite AI assessment.'
      });
    }
  }
);

/* =========================================================
   HUMAN VS AI COMPARISON
   GET /api/ignite-ai/comparison/:registrationId
   ========================================================= */

router.get(
  '/comparison/:registrationId',
  adminAuth,
  async (req, res) => {
    try {
      const registration =
        await Registration.findById(
          req.params.registrationId
        ).lean();

      if (!registration) {
        return res.status(404).json({
          error:
            'Participant registration not found.'
        });
      }

      const latestAbstract =
        pickLatestAbstract(
          registration.uploads
        );

      const igniteAssessment =
        getAssessmentForAbstract(
          registration,
          latestAbstract
        );

      const humanReview =
        await AbstractReview.findOne({
          registrationId:
            registration._id
        })
          .sort({ updatedAt: -1 })
          .lean();

      return res.json({
        ok: true,

        participant:
          participantSummary(
            registration
          ),

        humanReview:
          humanReview || null,

        igniteAIAssessment:
          serializeAssessment(
            igniteAssessment
          ),

        comparison:
          compareReviews(
            humanReview,
            igniteAssessment
          )
      });
    } catch (err) {
      console.error(
        'Ignite AI comparison error:',
        err
      );

      return res.status(500).json({
        error:
          'Failed to load human and Ignite AI comparison.'
      });
    }
  }
);

module.exports = router;
