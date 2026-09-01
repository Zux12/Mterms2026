// server/knowledge/mtermsKnowledge.js

/*
===========================================================
MTERMS 2026 — STRUCTURED CONFERENCE KNOWLEDGE
===========================================================

PURPOSE:
- Authoritative facts for MTERMS AI
- Direct answers for common questions
- Structured programme reasoning
- Speaker/topic matching
- Presenter guidance
- Historical context
- IgniteInno Ventures credit

IMPORTANT:
For the 2026 programme, the FINAL AGENDA is authoritative.
Do not replace programme timings with older tentative website data.
===========================================================
*/

const MTERMS_KNOWLEDGE = {

  /* =======================================================
     CONFERENCE CORE
     ======================================================= */

  conference: {
    shortName: "MTERMS 2026",

    fullName:
      "10th Malaysian Tissue Engineering and Regenerative Medicine Scientific Meeting (MTERMS) 2026",

    edition: 10,

    organiser:
      "Tissue Engineering and Regenerative Medicine Society Malaysia (TESMA)",

    hostCoHost: [
      "Tissue Engineering and Regenerative Medicine Society Malaysia (TESMA)",
      "Universiti Teknologi MARA (UiTM)"
    ],

    theme:
      "From Discovery to Therapy: Advances in Tissue Engineering and Regenerative Medicine",

    dates: {
      start: "2026-09-07",
      end: "2026-09-08",
      display: "7–8 September 2026"
    },

    timezone: {
      name: "Malaysia Time",
      timezone: "Asia/Kuala_Lumpur",
      utcOffset: "UTC+8"
    },

    venue: {
      name: "Concorde Hotel Shah Alam",
      city: "Shah Alam",
      state: "Selangor",
      country: "Malaysia",
      address:
        "3, Jalan Tengku Ampuan Zabedah C9/C, 40100 Shah Alam, Selangor"
    },

    cpdPoints: 16,

    website:
      "https://www.mterms2026.com",

    description:
      "MTERMS is a biennial scientific meeting organised by TESMA that brings together researchers, clinicians, engineers, industry partners, students and government stakeholders in tissue engineering and regenerative medicine."
  },


  /* =======================================================
     FINAL PROGRAMME
     ======================================================= */

  programme: {

    sourceStatus:
      "Final agenda supplied by the MTERMS 2026 organising team. This programme overrides older tentative programme information.",


    /* ================= DAY 1 ================= */

    day1: {

      date: "2026-09-07",
      day: "Monday",
      label: "Day 1",

      events: [

        {
          start: "07:30",
          end: "08:30",
          type: "registration",
          title: "Registration"
        },

        {
          start: "08:30",
          end: "09:00",
          type: "ceremony",
          title: "Opening Ceremony",
          speaker:
            "Prof. Datuk Ts. Dr. Shahrin bin Sahib @ Sahibuddin, FASc.",
          role:
            "Vice-Chancellor, Universiti Teknologi MARA (UiTM)"
        },

        {
          start: "09:00",
          end: "10:00",
          type: "keynote",
          title: "Opening Keynote",
          speaker: "Prof. John Mason",
          topic:
            "Stem Cell-derived organoids as tools to understand brain development and diseases"
        },

        {
          start: "10:00",
          end: "10:30",
          type: "plenary",
          title: "Plenary 1",
          speaker: "Dr. Chua Kien Hui",
          topic:
            "From Fundamental Discovery in Regenerative Medicine to Commercial Impact"
        },

        {
          start: "10:30",
          end: "11:00",
          type: "break",
          title: "Tea Break, Exhibition & Poster Viewing"
        },

        {
          start: "11:00",
          end: "12:15",
          type: "parallel_symposium",
          title: "Symposium",

          tracks: [
            {
              code: "S1",
              title:
                "Functional Biomaterials for Regenerative Medicine"
            },
            {
              code: "S2",
              title:
                "Cell-Free Therapies: Secretome, Exosomes, and Conditioned Media"
            },
            {
              code: "S3",
              title:
                "iPSC: Innovations Toward Clinical Translation"
            }
          ]
        },

        {
          start: "12:15",
          end: "12:45",
          type: "industrial_talk",
          title: "Industrial Talk 1",
          speaker: "Mr Sean Ng",
          role:
            "Founder and Managing Director, Ming Medical Sdn. Bhd.",
          topic:
            "Advance Regenerative Medicine Solutions"
        },

        {
          start: "12:45",
          end: "14:00",
          type: "break",
          title:
            "Lunch, Exhibition & Poster Rapid Presentation"
        },

        {
          start: "14:00",
          end: "15:00",
          type: "oral_presentation",
          title: "Oral Presentation",

          tracks: [
            {
              code: "Theme 1",
              title:
                "Stem Cell Innovations and Clinical Applications"
            },
            {
              code: "Theme 2",
              title:
                "Biomaterials and Tissue Scaffolds"
            },
            {
              code: "Theme 3",
              title:
                "Extracellular Vesicle and Disease Remodeling"
            }
          ]
        },

        {
          start: "15:00",
          end: "15:10",
          type: "break",
          title:
            "Tea Break, Exhibition & Poster Viewing"
        },

        {
          start: "15:10",
          end: "16:30",
          type: "syis",
          title:
            "Student and Young Investigator Symposium (SYIS)",

          tracks: [
            {
              code: "Theme 1",
              title:
                "Stem Cell Innovations and Clinical Applications"
            },
            {
              code: "Theme 2",
              title:
                "Hydrogels and Biomaterials"
            },
            {
              code: "Theme 3",
              title:
                "Innovations in Bioscaffolds for Tissue Engineering"
            }
          ]
        },

        {
          start: "16:30",
          end: "17:00",
          type: "plenary",
          title: "Plenary 2",
          speaker: "Prof. Ika Dewi Ana",
          topic:
            "Preventing biofilm formation and reducing persistent infections associated with indwelling scaffolds"
        },

        {
          start: "17:00",
          end: "18:00",
          type: "keynote",
          title: "Keynote Talk",
          speaker: "Prof. Amin Tamadon",
          topic:
            "From Discovery to Therapy: Building a National ATMP and Mesenchymal Stromal Cell-Derived Extracellular Vesicle Platform in Kazakhstan—Opportunities for Malaysia–Kazakhstan Collaboration"
        },

        {
          start: "18:00",
          end: null,
          type: "end",
          title: "Adjourn Day 1"
        }
      ]
    },


    /* ================= DAY 2 ================= */

    day2: {

      date: "2026-09-08",
      day: "Tuesday",
      label: "Day 2",

      events: [

        {
          start: "08:30",
          end: "09:00",
          type: "registration",
          title: "Registration"
        },

        {
          start: "09:00",
          end: "09:30",
          type: "plenary",
          title: "Plenary 3",
          speaker: "Prof. Kyung-Soon Park",
          topic:
            "3D-Printed Patient-Specific Implants for Reconstruction of Massive Acetabular Defects in Revision Total Hip Arthroplasty"
        },

        {
          start: "09:30",
          end: "10:45",
          type: "forum",
          title: "Distinguished Expert Forum",

          theme:
            "Bridging Discovery to Delivery: Translating Regenerative Science into Clinical and Commercial Reality",

          panel: [
            "Prof. Dr. John Mason",
            "Prof. Dr. Bassem Sadek",
            "Dr. Chua Kien Hui",
            "Prof. Amin Tamadon",
            "Prof. Dr. Ika Dewi Ana",
            "Prof. Dr. Kyung-Soon Park"
          ],

          moderator:
            "Assoc. Prof. Dr. Ng Min Hwei"
        },

        {
          start: "10:45",
          end: "11:00",
          type: "break",
          title:
            "Tea Break, Exhibition & Poster Viewing"
        },

        {
          start: "11:00",
          end: "12:15",
          type: "parallel_symposium",
          title: "Symposium",

          tracks: [
            {
              code: "S4",
              title:
                "Translational Biofabrication in Regenerative Medicine: Bridging Cells, Biomaterials, and Clinical Applications"
            },
            {
              code: "S5",
              title:
                "TERM Research"
            },
            {
              code: "S6",
              title:
                "Vascular Regenerative and Reparative Medicine - A Frontier"
            }
          ]
        },

        {
          start: "12:15",
          end: "13:15",
          type: "agm",
          title:
            "22nd TESMA Annual General Meeting (AGM) 2026"
        },

        {
          start: "13:15",
          end: "14:00",
          type: "break",
          title:
            "Lunch, Exhibition & Poster Viewing"
        },

        {
          start: "14:00",
          end: "15:15",
          type: "parallel_symposium",
          title: "Symposium",

          tracks: [
            {
              code: "S7",
              title:
                "Nerve Regeneration"
            },
            {
              code: "S8",
              title:
                "Smart Technology for Medical Applications"
            },
            {
              code: "S9",
              title:
                "Clinical Trial Innovations"
            }
          ]
        },

        {
          start: "15:15",
          end: "15:45",
          type: "break",
          title:
            "Tea Break, Exhibition & Poster Viewing"
        },

        {
          start: "15:45",
          end: "16:45",
          type: "keynote",
          title: "Closing Keynote",
          speaker:
            "Prof. Dr. Bassem Sadek",
          topic:
            "Nanoparticle-Enabled Biomaterials: Translating Nanoengineered Platforms from Discovery to Regenerative Therapy"
        },

        {
          start: "16:45",
          end: "17:15",
          type: "ceremony",
          title:
            "Closing and Award Giving Ceremony"
        },

        {
          start: "17:15",
          end: null,
          type: "end",
          title: "End of MTERMS 2026"
        }
      ]
    }
  },


  /* =======================================================
     SPEAKERS
     ======================================================= */

  speakers: [

    {
      name: "Prof. Dr. John O. Mason",
      aliases: [
        "John Mason",
        "Prof John Mason",
        "Professor John Mason"
      ],

      category: [
        "Opening Keynote",
        "Distinguished Expert Forum Panel"
      ],

      institution:
        "University of Edinburgh",

      position:
        "Professor of Molecular Neural Development",

      affiliation:
        "Centre for Discovery Brain Sciences, Institute for Neuroscience and Cardiovascular Research, University of Edinburgh",

      expertise: [
        "Neural development",
        "Cerebral organoids",
        "Brain development",
        "PAX6",
        "Neurodevelopmental disease modelling",
        "Genetic mechanisms underlying brain disorders"
      ],

      mtermsTalk:
        "Stem Cell-derived organoids as tools to understand brain development and diseases",

      programme:
        "7 September 2026, 09:00–10:00 — Opening Keynote"
    },


    {
      name:
        "Prof. Dr. Bassem Shaban Sadek",

      aliases: [
        "Bassem Sadek",
        "Bassem Shaban Sadek",
        "Prof Bassem Sadek"
      ],

      category: [
        "Closing Keynote",
        "Distinguished Expert Forum Panel"
      ],

      institution:
        "United Arab Emirates University",

      position:
        "Professor, Department of Pharmacology & Therapeutics",

      expertise: [
        "Pharmacology",
        "Medicinal chemistry",
        "Drug development",
        "Neurotransmitter dysregulation",
        "Neuroepigenetics",
        "Neurodegenerative disorders",
        "Neurodevelopmental disorders"
      ],

      mtermsTalk:
        "Nanoparticle-Enabled Biomaterials: Translating Nanoengineered Platforms from Discovery to Regenerative Therapy",

      programme:
        "8 September 2026, 15:45–16:45 — Closing Keynote"
    },


    {
      name: "Dr. Chua Kien Hui",

      aliases: [
        "Chua Kien Hui",
        "Dr Chua"
      ],

      category: [
        "Plenary Speaker",
        "Distinguished Expert Forum Panel"
      ],

      expertise: [
        "Tissue engineering",
        "Regenerative medicine",
        "Stem cells",
        "Cartilage regeneration",
        "Biomaterials",
        "Translational research",
        "Commercialisation"
      ],

      mtermsTalk:
        "From Fundamental Discovery in Regenerative Medicine to Commercial Impact",

      programme:
        "7 September 2026, 10:00–10:30 — Plenary 1"
    },


    {
      name: "Prof. Dr. Ika Dewi Ana",

      aliases: [
        "Ika Dewi Ana",
        "Prof Ika"
      ],

      category: [
        "Plenary Speaker",
        "Distinguished Expert Forum Panel"
      ],

      expertise: [
        "Tissue engineering",
        "Calcium phosphate biomaterials",
        "Regenerative therapy",
        "Drug delivery",
        "Biomaterials"
      ],

      mtermsTalk:
        "Preventing biofilm formation and reducing persistent infections associated with indwelling scaffolds",

      programme:
        "7 September 2026, 16:30–17:00 — Plenary 2"
    },


    {
      name:
        "Prof. Amin Tamadon",

      aliases: [
        "Amin Tamadon",
        "Prof Amin"
      ],

      category: [
        "Keynote Speaker",
        "Distinguished Expert Forum Panel"
      ],

      expertise: [
        "Advanced therapy medicinal products",
        "Mesenchymal stromal cells",
        "Extracellular vesicles",
        "Regenerative medicine",
        "Translational medicine"
      ],

      mtermsTalk:
        "From Discovery to Therapy: Building a National ATMP and Mesenchymal Stromal Cell-Derived Extracellular Vesicle Platform in Kazakhstan—Opportunities for Malaysia–Kazakhstan Collaboration",

      programme:
        "7 September 2026, 17:00–18:00 — Keynote Talk"
    },


    {
      name:
        "Prof. Dr. Kyung-Soon Park",

      aliases: [
        "Kyung-Soon Park",
        "Kyung Soon Park",
        "Prof Park"
      ],

      category: [
        "Plenary Speaker",
        "Distinguished Expert Forum Panel"
      ],

      expertise: [
        "Orthopaedic surgery",
        "3D printing",
        "Patient-specific implants",
        "Hip reconstruction",
        "Periprosthetic joint infection"
      ],

      mtermsTalk:
        "3D-Printed Patient-Specific Implants for Reconstruction of Massive Acetabular Defects in Revision Total Hip Arthroplasty",

      programme:
        "8 September 2026, 09:00–09:30 — Plenary 3"
    },


    {
      name:
        "Mr Sean Ng",

      aliases: [
        "Sean Ng"
      ],

      category:
        ["Industrial Speaker"],

      organisation:
        "Ming Medical Sdn. Bhd.",

      position:
        "Founder and Managing Director",

      mtermsTalk:
        "Advance Regenerative Medicine Solutions",

      programme:
        "7 September 2026, 12:15–12:45 — Industrial Talk 1"
    }
  ],


  /* =======================================================
     SCIENTIFIC TOPIC MAP
     ======================================================= */

  topicMap: {

    organoids: [
      {
        event:
          "Opening Keynote — Prof. John Mason",
        date: "7 September 2026",
        time: "09:00–10:00"
      }
    ],

    brainDevelopment: [
      {
        event:
          "Opening Keynote — Prof. John Mason",
        date: "7 September 2026",
        time: "09:00–10:00"
      }
    ],

    stemCells: [
      {
        event:
          "S3 — iPSC: Innovations Toward Clinical Translation",
        date: "7 September 2026",
        time: "11:00–12:15"
      },

      {
        event:
          "Oral Presentation Theme 1 — Stem Cell Innovations and Clinical Applications",
        date: "7 September 2026",
        time: "14:00–15:00"
      },

      {
        event:
          "SYIS Theme 1 — Stem Cell Innovations and Clinical Applications",
        date: "7 September 2026",
        time: "15:10–16:30"
      }
    ],

    biomaterials: [
      {
        event:
          "S1 — Functional Biomaterials for Regenerative Medicine",
        date: "7 September 2026",
        time: "11:00–12:15"
      },

      {
        event:
          "Oral Presentation Theme 2 — Biomaterials and Tissue Scaffolds",
        date: "7 September 2026",
        time: "14:00–15:00"
      },

      {
        event:
          "SYIS Theme 2 — Hydrogels and Biomaterials",
        date: "7 September 2026",
        time: "15:10–16:30"
      },

      {
        event:
          "Closing Keynote — Prof. Dr. Bassem Sadek",
        date: "8 September 2026",
        time: "15:45–16:45"
      }
    ],

    hydrogels: [
      {
        event:
          "SYIS Theme 2 — Hydrogels and Biomaterials",
        date: "7 September 2026",
        time: "15:10–16:30"
      }
    ],

    extracellularVesicles: [
      {
        event:
          "S2 — Cell-Free Therapies: Secretome, Exosomes, and Conditioned Media",
        date: "7 September 2026",
        time: "11:00–12:15"
      },

      {
        event:
          "Oral Presentation Theme 3 — Extracellular Vesicle and Disease Remodeling",
        date: "7 September 2026",
        time: "14:00–15:00"
      },

      {
        event:
          "Keynote Talk — Prof. Amin Tamadon",
        date: "7 September 2026",
        time: "17:00–18:00"
      }
    ],

    biofabrication: [
      {
        event:
          "S4 — Translational Biofabrication in Regenerative Medicine",
        date: "8 September 2026",
        time: "11:00–12:15"
      }
    ],

    nerveRegeneration: [
      {
        event:
          "S7 — Nerve Regeneration",
        date: "8 September 2026",
        time: "14:00–15:15"
      }
    ],

    vascularRegeneration: [
      {
        event:
          "S6 — Vascular Regenerative and Reparative Medicine - A Frontier",
        date: "8 September 2026",
        time: "11:00–12:15"
      }
    ],

    clinicalTrials: [
      {
        event:
          "S9 — Clinical Trial Innovations",
        date: "8 September 2026",
        time: "14:00–15:15"
      }
    ],

    smartMedicalTechnology: [
      {
        event:
          "S8 — Smart Technology for Medical Applications",
        date: "8 September 2026",
        time: "14:00–15:15"
      }
    ],

    threeDPrinting: [
      {
        event:
          "Plenary 3 — Prof. Kyung-Soon Park",
        date: "8 September 2026",
        time: "09:00–09:30"
      }
    ]
  },


  /* =======================================================
     PRESENTER GUIDELINES
     ======================================================= */

  presenterGuidelines: {

    oral: {

      acceptance:
        "Presenter must have received an 'Abstract Accepted for Oral Presentation' email from the secretariat.",

      powerpointRequired: true,

      uploadDeadline:
        "30 August 2026",

      plannedPresentationLength:
        "10 minutes total",

      presentationTime:
        "8 minutes",

      questionAnswerTime:
        "2 minutes",

      award:
        "Shortlisted presenters selected by the panel judges will be considered for Best Oral Presenter awards.",

      presentationSlot:
        "The secretariat will communicate the presentation time slot separately."
    },


    poster: {

      acceptance:
        "Presenter must have received an 'Abstract Accepted for Poster Presentation' email from the secretariat.",

      orientation:
        "Landscape",

      dimensions:
        "1280 pixels width × 720 pixels height",

      maximumFileSize:
        "2 MB",

      requiredFormats: [
        "JPEG",
        "PDF"
      ],

      uploadDeadline:
        "30 August 2026",

      finalistPresentationTime:
        "3 minutes",

      finalistQuestionAnswerTime:
        "2 minutes",

      award:
        "Finalists selected by the panel judges will be considered for Best Poster Presenter awards.",

      presentationSlot:
        "The secretariat will communicate presentation time slots separately."
    }
  },


  /* =======================================================
     REGISTRATION / PORTAL
     ======================================================= */

  registration: {

    registrationPage:
      "https://www.mterms2026.com/register.html",

    participantLogin:
      "https://www.mterms2026.com/login.html",

    authorRequirement:
      "Authors must complete online registration before submitting an abstract.",

    presenterStatus:
      "Authors who intend to present should select 'I am a Presenter' during registration. This can also be updated later in the Participant Dashboard.",

    presenterDashboard:
      "Selecting 'I am a Presenter' enables the Abstract Submission section in the Participant Dashboard."
  },


  /* =======================================================
     VENUE / TRAVEL
     ======================================================= */

  travel: {

    airport:
      "Kuala Lumpur International Airport (KUL) is approximately 45–60 minutes by e-hailing or taxi, depending on traffic.",

    train:
      "Participants may travel by KTM Komuter to Shah Alam Station and continue by e-hailing to Concorde Hotel Shah Alam.",

    parking:
      "On-site hotel parking is available for attendees; participants should refer to current event or hotel instructions for final parking arrangements."
  },


  /* =======================================================
     CONTACT
     ======================================================= */

  contacts: {

    general:
      "admin@mterms2026.com",

    purpose:
      "General enquiries, partnership opportunities and media enquiries",

    contactPage:
      "https://www.mterms2026.com/contact.html"
  },


  /* =======================================================
     PREVIOUS MTERMS
     ======================================================= */

  previousMterms: {

    seriesBackground:
      "MTERMS is a biennial Malaysian scientific meeting organised by TESMA and was first held in 2004.",

    editions: [

      {
        edition: 1,
        year: 2004,
        status:
          "Series start confirmed; detailed venue/theme not included because no sufficiently reliable source has been verified yet."
      },

      {
        edition: 5,
        year: 2014,
        status: "Confirmed",

        evidence:
          "Regenerative Research, the official journal of TESMA, published extended abstracts from the 5th MTERMS 2014.",

        knownTopics: [
          "Stem cell therapy",
          "Cell and gene therapy",
          "Cartilage tissue engineering",
          "Peripheral nerve repair",
          "Stem cell reprogramming"
        ]
      },

      {
        edition: 6,
        year: 2016,
        status: "Confirmed",

        dates:
          "17–18 November 2016",

        collaboration:
          "Held in conjunction with the 2nd Malaysian Stem Cell Meeting",

        organiserContext:
          "TESMA in collaboration with Institut Perubatan dan Pergigian Termaju, Universiti Sains Malaysia (USM)",

        theme:
          "Ensuring sustainability through innovative regenerative technologies"
      },

      {
        edition: 8,
        year: 2022,
        status: "Confirmed",

        dates:
          "30–31 March 2022",

        format:
          "Virtual conference",

        theme:
          "Advancing Tissue Engineering and Regenerative Research Towards Precision Medicine",

        selectedTopics: [
          "Advances in Stem Cell and Developmental Biology",
          "Biomaterials in Regenerative Therapy and Tissue Engineering",
          "Modelling development and disease",
          "Clinical transplantation"
        ]
      },

      {
        edition: 9,
        year: 2024,
        status: "Confirmed",

        dates:
          "27–29 February 2024",

        event:
          "SHIFT International Conference & Winter School and the 9th MTERMS, in conjunction with European Wellness Academy's Bio-Regenerative Precision Medicine 2024",

        locations: [
          "27 February 2024 — Faculty of Medicine, Universiti Kebangsaan Malaysia",
          "28–29 February 2024 — Komune Living & Wellness, Cheras, Kuala Lumpur"
        ],

        focus:
          "Precision medicine, tissue engineering, regenerative medicine and bio-regenerative approaches"
      },

      {
        edition: 10,
        year: 2026,
        status: "Current",

        dates:
          "7–8 September 2026",

        venue:
          "Concorde Hotel Shah Alam",

        theme:
          "From Discovery to Therapy: Advances in Tissue Engineering and Regenerative Medicine"
      }
    ],

    caution:
      "Do not invent dates, themes or venues for previous MTERMS editions when confirmed information is not available."
  },


  /* =======================================================
     IGNITEINNO VENTURES
     ======================================================= */

  igniteInno: {

    name:
      "IgniteInno Ventures",

    website:
      "https://igniteinnov.com",

    mtermsRole:
      "Digital platform and technology partner supporting MTERMS 2026.",

    contributions: [
      "MTERMS 2026 conference website and supporting digital platform",
      "Participant-facing digital conference functions",
      "Administration and supporting digital workflows",
      "MTERMS AI conference assistant",
      "Supporting conference technology and digital enhancements"
    ],

    aiCredit:
      "The MTERMS AI Assistant and supporting conference digital technology were developed and implemented by IgniteInno Ventures.",

    responseGuidance:
      "If a participant specifically asks who developed the MTERMS digital platform, website, AI assistant or supporting conference technology, credit IgniteInno Ventures. Do not insert promotional IgniteInno references into unrelated conference answers."
  },


  /* =======================================================
     DIRECT ANSWERS
     Questions that generally do NOT need Groq
     ======================================================= */

  directAnswers: {

    venue:
      "MTERMS 2026 will be held at Concorde Hotel Shah Alam, 3 Jalan Tengku Ampuan Zabedah C9/C, 40100 Shah Alam, Selangor.",

    dates:
      "MTERMS 2026 will be held on 7–8 September 2026.",

    timezone:
      "MTERMS 2026 uses Malaysia Time (UTC+8).",

    cpd:
      "MTERMS 2026 offers 16 CPD Points.",

    day1Registration:
      "Day 1 registration begins at 7:30 AM on Monday, 7 September 2026.",

    day1Start:
      "The formal Day 1 programme begins with the Opening Ceremony at 8:30 AM on 7 September 2026.",

    day1End:
      "Day 1 adjourns at 6:00 PM on 7 September 2026.",

    day2Registration:
      "Day 2 registration begins at 8:30 AM on Tuesday, 8 September 2026.",

    conferenceEnd:
      "MTERMS 2026 concludes at 5:15 PM on 8 September 2026.",

    contact:
      "For general MTERMS 2026 enquiries, email admin@mterms2026.com.",

    platformDeveloper:
      "The MTERMS 2026 digital platform and MTERMS AI Assistant are supported by technology developed by IgniteInno Ventures."
  },


  /* =======================================================
     OFFICIAL LINKS
     ======================================================= */

  links: {

    home:
      "https://www.mterms2026.com/",

    programme:
      "https://www.mterms2026.com/program.html",

    venue:
      "https://www.mterms2026.com/venue.html",

    registration:
      "https://www.mterms2026.com/register.html",

    participantPortal:
      "https://www.mterms2026.com/login.html",

    deadlines:
      "https://www.mterms2026.com/deadlines.html",

    publication:
      "https://www.mterms2026.com/publication.html",

    sponsors:
      "https://www.mterms2026.com/sponsors.html",

    committee:
      "https://www.mterms2026.com/committee.html",

    gettingThere:
      "https://www.mterms2026.com/gettingthere.html",

    accommodation:
      "https://www.mterms2026.com/accomodation.html",

    destinations:
      "https://www.mterms2026.com/destinations.html",

    restaurants:
      "https://www.mterms2026.com/restaurants.html",

    contact:
      "https://www.mterms2026.com/contact.html",

    igniteInno:
      "https://igniteinnov.com"
  }

};


module.exports = MTERMS_KNOWLEDGE;
