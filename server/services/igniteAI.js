// server/services/igniteAI.js

const OpenAI = require('openai');

const RUBRIC_VERSION = 'MTERMS-2026-v1';

const RESULTS_ALLOWED = [0, 2, 4, 6, 8, 10];
const SIGNIFICANCE_ALLOWED = [0, 2, 4, 6, 8, 10];

function getOpenAIClient() {
  const apiKey = String(process.env.OPENAI_API_KEY || '').trim();

  if (!apiKey) {
    throw new Error(
      'Ignite AI is not configured. OPENAI_API_KEY is missing from the server environment.'
    );
  }

  return new OpenAI({ apiKey });
}

function cleanText(value) {
  return String(value ?? '')
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

function requireNonEmptyText(value, fieldName) {
  const text = cleanText(value);

  if (!text) {
    throw new Error(`${fieldName} is missing.`);
  }

  return text;
}

function assertIntegerInRange(value, min, max, fieldName) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(
      `Ignite AI returned an invalid ${fieldName} score.`
    );
  }

  return value;
}

function assertAllowedScore(value, allowed, fieldName) {
  if (!Number.isInteger(value) || !allowed.includes(value)) {
    throw new Error(
      `Ignite AI returned an invalid ${fieldName} score.`
    );
  }

  return value;
}

function assertBoolean(value, fieldName) {
  if (typeof value !== 'boolean') {
    throw new Error(
      `Ignite AI returned an invalid ${fieldName} value.`
    );
  }

  return value;
}

function assertShortExplanation(value, fieldName) {
  const text = cleanText(value);

  if (!text) {
    throw new Error(
      `Ignite AI did not provide a justification for ${fieldName}.`
    );
  }

  return text.slice(0, 2000);
}

function validateAssessment(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Ignite AI returned an invalid assessment.');
  }

  const scores = raw.scores;

  if (!scores || typeof scores !== 'object' || Array.isArray(scores)) {
    throw new Error('Ignite AI returned incomplete scores.');
  }

  const introductionObjective = assertIntegerInRange(
    scores.introductionObjective,
    0,
    5,
    'Introduction & Objective'
  );

  const materialsMethods = assertIntegerInRange(
    scores.materialsMethods,
    0,
    5,
    'Materials and Methods'
  );

  const results = assertAllowedScore(
    scores.results,
    RESULTS_ALLOWED,
    'Results'
  );

  const conclusion = assertIntegerInRange(
    scores.conclusion,
    0,
    5,
    'Conclusion'
  );

  const significanceImplication = assertAllowedScore(
    scores.significanceImplication,
    SIGNIFICANCE_ALLOWED,
    'Significance / Implication'
  );

  const calculatedTotal =
    introductionObjective +
    materialsMethods +
    results +
    conclusion +
    significanceImplication;

  if (
    !Number.isInteger(scores.total) ||
    scores.total !== calculatedTotal
  ) {
    throw new Error(
      'Ignite AI returned an incorrect total score.'
    );
  }

  const justifications = raw.scoreJustifications;

  if (
    !justifications ||
    typeof justifications !== 'object' ||
    Array.isArray(justifications)
  ) {
    throw new Error(
      'Ignite AI returned incomplete score justifications.'
    );
  }

  const requireCorrection = String(
    raw.requireCorrection || ''
  ).toLowerCase();

  if (!['yes', 'no'].includes(requireCorrection)) {
    throw new Error(
      'Ignite AI returned an invalid Require Correction decision.'
    );
  }

  const reasons = raw.correctionReasons;

  if (!reasons || typeof reasons !== 'object' || Array.isArray(reasons)) {
    throw new Error(
      'Ignite AI returned incomplete correction reasons.'
    );
  }

  const correctionReasons = {
    tooLong: assertBoolean(reasons.tooLong, 'tooLong'),
    poorlyWritten: assertBoolean(
      reasons.poorlyWritten,
      'poorlyWritten'
    ),
    weakHypothesis: assertBoolean(
      reasons.weakHypothesis,
      'weakHypothesis'
    ),
    vagueExperimentalPlan: assertBoolean(
      reasons.vagueExperimentalPlan,
      'vagueExperimentalPlan'
    ),
    insufficientData: assertBoolean(
      reasons.insufficientData,
      'insufficientData'
    ),
    others: assertBoolean(reasons.others, 'others'),
    othersText: cleanText(reasons.othersText || '').slice(0, 1000)
  };

  const selectedReasons = [
    correctionReasons.tooLong,
    correctionReasons.poorlyWritten,
    correctionReasons.weakHypothesis,
    correctionReasons.vagueExperimentalPlan,
    correctionReasons.insufficientData,
    correctionReasons.others
  ].some(Boolean);

  if (requireCorrection === 'yes' && !selectedReasons) {
    throw new Error(
      'Ignite AI selected Require Correction but did not provide a correction reason.'
    );
  }

  if (
    correctionReasons.others &&
    !correctionReasons.othersText
  ) {
    throw new Error(
      'Ignite AI selected Other correction reason but did not explain it.'
    );
  }

  if (requireCorrection === 'no') {
    correctionReasons.tooLong = false;
    correctionReasons.poorlyWritten = false;
    correctionReasons.weakHypothesis = false;
    correctionReasons.vagueExperimentalPlan = false;
    correctionReasons.insufficientData = false;
    correctionReasons.others = false;
    correctionReasons.othersText = '';
  }

  const recommendedCategory = String(
    raw.recommendedCategory || ''
  ).trim();

  if (
    ![
      'Oral presentation',
      'Poster presentation'
    ].includes(recommendedCategory)
  ) {
    throw new Error(
      'Ignite AI returned an invalid recommended category.'
    );
  }

  return {
    scores: {
      introductionObjective,
      materialsMethods,
      results,
      conclusion,
      significanceImplication,
      total: calculatedTotal
    },

    scoreJustifications: {
      introductionObjective: assertShortExplanation(
        justifications.introductionObjective,
        'Introduction & Objective'
      ),

      materialsMethods: assertShortExplanation(
        justifications.materialsMethods,
        'Materials and Methods'
      ),

      results: assertShortExplanation(
        justifications.results,
        'Results'
      ),

      conclusion: assertShortExplanation(
        justifications.conclusion,
        'Conclusion'
      ),

      significanceImplication: assertShortExplanation(
        justifications.significanceImplication,
        'Significance / Implication'
      )
    },

    requireCorrection,
    correctionReasons,
    recommendedCategory
  };
}

function buildDeveloperInstruction() {
  return `
You are Ignite AI™, an additional scientific abstract reviewer for MTERMS 2026.

You must assess the submitted abstract independently using exactly the same rubric as the human MTERMS panel reviewer.

IMPORTANT RULES:

1. Assess only information explicitly present in the supplied abstract.
2. Do not invent missing experiments, methods, data, findings or conclusions.
3. Missing information must reduce the relevant score.
4. Do not identify, infer or discuss the participant's identity.
5. Do not use external web research.
6. Do not compare the work with specific outside publications.
7. Give only scores permitted by the MTERMS rubric.
8. The total must equal the sum of all five criteria.
9. Provide a concise evidence-based justification for every score.
10. Determine whether correction is required using the same correction reasons as the human reviewer.
11. Recommend either Oral presentation or Poster presentation.
12. Return only the requested JSON structure.

MTERMS 2026 SCORING RUBRIC

A. Introduction & Objective — maximum 5

5 — Exemplary:
The literature review is clearly demonstrated. The problem background is strong, clear, thorough and concise. A specific, clear and testable objective is stated from the knowledge gap.

4 — Outstanding:
The literature is reviewed. The problem background is clear and reasonably thorough. A clear and testable objective is stated.

3 — Strong:
The literature review is partially demonstrated. The background is clear and somewhat thorough. A testable objective is stated.

2 — Adequate:
The literature review is weak. The background is not clearly informed by the aims. The objective is clear but untestable.

1 — Weak:
The literature review is not demonstrated. The background is not informed by the aims. The objective is vague and untestable.

0 — Poor:
The introduction and research objective are absent.

B. Materials and Methods — maximum 5

5 — Exemplary:
Strong and clear explanation of the experimental methods.

4 — Outstanding:
Clear explanation of the experimental methods.

3 — Strong:
Adequate explanation of the experimental methods.

2 — Adequate:
Unorganised explanation of the experimental methods.

1 — Weak:
Unclear and unorganised explanation of the experimental methods.

0 — Poor:
Methods are absent.

C. Results — maximum 10

Allowed scores are only: 0, 2, 4, 6, 8 or 10.

10 — Exemplary:
Results are clear and connected to the study purpose. They strictly follow the methods and present findings without interpretation.

8 — Outstanding:
Results are clear and connected to the study purpose. They mainly follow the methods, with some interpretation.

6 — Strong:
Findings are presented but may be unclear or have some missing information. Results follow the methods.

4 — Adequate:
Findings are unclear and information is missing. Results only loosely follow the methods.

2 — Weak:
No concrete data, unclear findings, findings unrelated to the purpose, or results do not follow the methods.

0 — Poor:
Results or data are absent, or results are stated as future work.

D. Conclusion — maximum 5

5 — Exemplary:
Fully supported by the study results.

4 — Outstanding:
Mostly supported by the study results.

3 — Strong:
Partially supported by the study results.

2 — Adequate:
Weakly supported by the study results.

1 — Weak:
Not supported by the study results.

0 — Poor:
Conclusion is absent.

E. Significance / Implication — maximum 10

Allowed scores are only: 0, 2, 4, 6, 8 or 10.

10 — Exemplary:
The rationale and importance are presented as a well-structured and logical argument.

8 — Outstanding:
The rationale and importance are presented as a partially well-structured argument.

6 — Strong:
The rationale and importance are presented as a structured argument.

4 — Adequate:
The rationale and importance are weakly presented as a structured argument.

2 — Weak:
Some effort is made to present rationale and significance.

0 — Poor:
The rationale and importance are not articulated.

CORRECTION REASONS

tooLong:
The abstract is more than one page or more than 250 words.

poorlyWritten:
The abstract is poorly written.

weakHypothesis:
There is a poorly supported research hypothesis or objective.

vagueExperimentalPlan:
The experimental plan is vague or not well described.

insufficientData:
The data are insufficient, or the analysis is inadequate, to justify the presentation.

others:
Use only when another material correction issue exists and explain it in othersText.
`.trim();
}

function buildUserInput({
  title,
  theme,
  field,
  presentationType,
  abstractText
}) {
  return `
ABSTRACT TITLE:
${cleanText(title) || 'Not supplied'}

THEME:
${cleanText(theme) || 'Not supplied'}

FIELD:
${cleanText(field) || 'Not supplied'}

PARTICIPANT PRESENTATION PREFERENCE:
${cleanText(presentationType) || 'Not supplied'}

ABSTRACT TEXT:
${abstractText}
`.trim();
}

async function assessAbstract({
  title,
  theme,
  field,
  presentationType,
  abstractText
}) {
  const preparedAbstractText = requireNonEmptyText(
    abstractText,
    'Abstract text'
  );

  if (preparedAbstractText.length < 100) {
    throw new Error(
      'The extracted abstract text is too short for assessment.'
    );
  }

  if (preparedAbstractText.length > 50000) {
    throw new Error(
      'The extracted abstract text is too long for assessment.'
    );
  }

  const client = getOpenAIClient();

  const model = String(
    process.env.IGNITE_AI_MODEL || 'gpt-5-mini'
  ).trim();

  const response = await client.responses.create({
    model,

    instructions: buildDeveloperInstruction(),

    input: buildUserInput({
      title,
      theme,
      field,
      presentationType,
      abstractText: preparedAbstractText
    }),

    text: {
      format: {
        type: 'json_schema',
        name: 'mterms_ignite_ai_assessment',
        strict: true,

        schema: {
          type: 'object',
          additionalProperties: false,

          properties: {
            scores: {
              type: 'object',
              additionalProperties: false,

              properties: {
                introductionObjective: {
                  type: 'integer',
                  minimum: 0,
                  maximum: 5
                },

                materialsMethods: {
                  type: 'integer',
                  minimum: 0,
                  maximum: 5
                },

                results: {
                  type: 'integer',
                  enum: [0, 2, 4, 6, 8, 10]
                },

                conclusion: {
                  type: 'integer',
                  minimum: 0,
                  maximum: 5
                },

                significanceImplication: {
                  type: 'integer',
                  enum: [0, 2, 4, 6, 8, 10]
                },

                total: {
                  type: 'integer',
                  minimum: 0,
                  maximum: 35
                }
              },

              required: [
                'introductionObjective',
                'materialsMethods',
                'results',
                'conclusion',
                'significanceImplication',
                'total'
              ]
            },

            scoreJustifications: {
              type: 'object',
              additionalProperties: false,

              properties: {
                introductionObjective: {
                  type: 'string'
                },

                materialsMethods: {
                  type: 'string'
                },

                results: {
                  type: 'string'
                },

                conclusion: {
                  type: 'string'
                },

                significanceImplication: {
                  type: 'string'
                }
              },

              required: [
                'introductionObjective',
                'materialsMethods',
                'results',
                'conclusion',
                'significanceImplication'
              ]
            },

            requireCorrection: {
              type: 'string',
              enum: ['yes', 'no']
            },

            correctionReasons: {
              type: 'object',
              additionalProperties: false,

              properties: {
                tooLong: {
                  type: 'boolean'
                },

                poorlyWritten: {
                  type: 'boolean'
                },

                weakHypothesis: {
                  type: 'boolean'
                },

                vagueExperimentalPlan: {
                  type: 'boolean'
                },

                insufficientData: {
                  type: 'boolean'
                },

                others: {
                  type: 'boolean'
                },

                othersText: {
                  type: 'string'
                }
              },

              required: [
                'tooLong',
                'poorlyWritten',
                'weakHypothesis',
                'vagueExperimentalPlan',
                'insufficientData',
                'others',
                'othersText'
              ]
            },

            recommendedCategory: {
              type: 'string',
              enum: [
                'Oral presentation',
                'Poster presentation'
              ]
            }
          },

          required: [
            'scores',
            'scoreJustifications',
            'requireCorrection',
            'correctionReasons',
            'recommendedCategory'
          ]
        }
      }
    }
  });

  if (!response || response.status !== 'completed') {
    const reason =
      response?.incomplete_details?.reason ||
      'The AI service did not complete the assessment.';

    throw new Error(reason);
  }

  const outputText = cleanText(response.output_text);

  if (!outputText) {
    throw new Error(
      'Ignite AI returned an empty assessment.'
    );
  }

  let parsed;

  try {
    parsed = JSON.parse(outputText);
  } catch (err) {
    throw new Error(
      'Ignite AI returned an unreadable assessment.'
    );
  }

  const assessment = validateAssessment(parsed);

  return {
    ...assessment,
    model,
    rubricVersion: RUBRIC_VERSION
  };
}

module.exports = {
  assessAbstract,
  validateAssessment,
  RUBRIC_VERSION
};
