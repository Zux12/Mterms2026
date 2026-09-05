/* =========================================================
   MTERMS 2026 LIVE EXPERIENCE V2
   MASTER PROGRAMME DATA

   File:
   /public/mterms-programme-v2.js

   IMPORTANT
   ---------------------------------------------------------
   This file is the SINGLE SOURCE OF TRUTH for V2.

   It contains:
   - Overall Day 1 / Day 2 timetable
   - Keynote / Plenary / Industrial speakers
   - Distinguished Expert Forum
   - SP1–SP9
   - Professional Oral Presentations
   - SYIS Presentations
   - Rooms
   - Chairs
   - Judges
   - Individual presenter IDs
   - Individual talk titles
   - Individual presentation times where supplied
   - Featured-speaker biographies

   DO NOT change existing discussion/session IDs such as:
   d1-s1
   d1-s2
   d1-op1
   d1-syis1
   d2-s4
   etc.

   MongoDB discussion data already uses those IDs.

   New presenter feedback will instead use:
   presenterId

   Example:
   d1-op1-p01

========================================================= */

(function(){

  "use strict";


  /* =====================================================
     FEATURED SPEAKER BIOGRAPHIES

     Bios are intentionally provided ONLY for:
     - Keynote
     - Plenary
     - Industrial Lecture

     Symposium / Oral / SYIS presenters do NOT use bios.

     Photo support is intentionally disabled for now.
  ===================================================== */

  const FEATURED_BIOS = {


    /* -------------------------------------------------
       OPENING KEYNOTE
    ------------------------------------------------- */

    "featured-john-mason": {

      name:
        "Prof. Dr. John O. Mason",

      affiliation:
        "University of Edinburgh, United Kingdom",

      bio:
        "Professor Dr John O. Mason is a Professor of Molecular Neural Development at the Centre for Discovery Brain Sciences, Institute for Neuroscience and Cardiovascular Research, University of Edinburgh. His research focuses on neural development, cerebral organoids, and genetic mechanisms underlying brain disorders, with particular expertise in transcription factors such as PAX6 and neurodevelopmental disease modelling. He has led major international research projects and serves on international scientific advisory and grant review panels."

      /*
      photo:
        "/public/john.jpeg"
      */

    },


    /* -------------------------------------------------
       PLENARY 1
    ------------------------------------------------- */

    "featured-chua-kien-hui": {

      name:
        "Dr. Chua Kien Hui",

      affiliation:
        "Supergenics Berhad, Malaysia",

      bio:
        "Dr Chua Kien Hui is an expert in tissue engineering and regenerative medicine with more than two decades of experience spanning academia, industry and translational research. He holds a PhD in Physiology specialising in Tissue Engineering and has published extensively in stem cells, cartilage regeneration, biomaterials and natural bioactives. He has held senior academic leadership roles and currently serves in senior research, technology and medical science leadership positions across biotechnology companies. He is actively involved in innovation, intellectual property and commercialisation of regenerative medicine technologies."

      /*
      photo:
        "/public/chua.jpeg"
      */

    },


    /* -------------------------------------------------
       PLENARY 2
    ------------------------------------------------- */

    "featured-ika-dewi-ana": {

      name:
        "Prof. Dr. Ika Dewi Ana",

      affiliation:
        "Universitas Gadjah Mada, Indonesia",

      bio:
        "Professor Dr Ika Dewi Ana is a dentist-scientist and biomedical researcher specialising in tissue engineering, calcium phosphate biomaterials, regenerative therapy and advanced drug delivery systems. Her work integrates biomaterials innovation with regenerative medicine and personalised therapeutic strategies. She has successfully commercialised multiple carbonate apatite-based medical technologies and holds numerous patents in regenerative biomaterials. Her work has received major international recognition for innovation in medicine and biotechnology."

      /*
      photo:
        "/public/ika.jpeg"
      */

    },


    /* -------------------------------------------------
       KEYNOTE TALK
    ------------------------------------------------- */

    "featured-amin-tamadon": {

      name:
        "Prof. Amin Tamadon",

      affiliation:
        "West Kazakhstan Marat Ospanov Medical University, Kazakhstan",

      bio:
        "Professor Amin Tamadon, PhD, is a Full Professor and Principal Investigator of Regenerative Medicine at West Kazakhstan Marat Ospanov Medical University, Kazakhstan. His research focuses on mesenchymal stromal cells, extracellular vesicles and exosomes, tissue engineering, reproductive regenerative medicine, biomaterials and translational therapy development. He is a senior scientific leader in Kazakhstan's nationally funded exosome and advanced therapy medicinal product development programme and contributes to the establishment of an Advanced Therapy Medicinal Products Center integrating manufacturing, characterisation, quality control, preclinical evaluation, regulatory preparation and early-phase clinical translation."

      /*
      photo:
        "/public/amin.jpeg"
      */

    },


    /* -------------------------------------------------
       PLENARY 3
    ------------------------------------------------- */

    "featured-kyung-soon-park": {

      name:
        "Prof. Dr. Kyung-Soon Park",

      affiliation:
        "Chonnam National University Hwasun Hospital, South Korea",

      bio:
        "Professor Kyung-Soon Park, M.D., Ph.D., is a professor in the Department of Orthopedic Surgery at Chonnam National University Medical School and leads orthopaedic clinical work at Chonnam National University Hwasun Hospital. He previously completed research training at the Wake Forest Institute for Regenerative Medicine in the United States. His clinical and research interests include hip surgery, periprosthetic joint infection, regenerative medicine and 3D printing for patient-specific orthopaedic reconstruction."

      /*
      photo:
        "/public/kyung.jpeg"
      */

    },


    /* -------------------------------------------------
       CLOSING KEYNOTE
    ------------------------------------------------- */

    "featured-bassem-sadek": {

      name:
        "Prof. Dr. Bassem Shaban Sadek",

      affiliation:
        "United Arab Emirates University, United Arab Emirates",

      bio:
        "Dr Bassem Shaban Sadek is a Professor in the Department of Pharmacology & Therapeutics, College of Medicine and Health Sciences, United Arab Emirates University. He also serves as a Research Associate at Heinrich Heine University of Düsseldorf, Germany. His research focuses on medicinal chemistry, preclinical pharmacology and clinical drug development, particularly neurotransmitter dysregulation and the neuroepigenetics of neurodegenerative and neurodevelopmental disorders. He has authored more than 120 scientific publications and is listed among the top 2% of scientists worldwide in the PLOS–Elsevier-Stanford ranking."

      /*
      photo:
        "/public/bassem.jpeg"
      */

    },


    /* -------------------------------------------------
       INDUSTRIAL LECTURE
    ------------------------------------------------- */

    "featured-sean-ng": {

      name:
        "Sean Ng See Nguan",

      affiliation:
        "Ming Medical Sdn. Bhd., Malaysia",

      bio:
        "Sean Ng See Nguan is the Founder and Managing Director of Ming Medical Sdn. Bhd., a company specialising in cell and regenerative medicine therapy. Since establishing Ming Medical in 2014, he has been involved in the development and promotion of regenerative medicine and provides scientific and strategic consultation to healthcare practices in Malaysia and internationally. His interests include mesenchymal stem cell therapy, exosomes, natural killer cells and longevity medicine. Before entering regenerative medicine, he held senior positions in the technology industry and began his professional career as a Clinical Research Officer at Imperial College London. He holds a BSc in Clinical Biochemistry from the University of Liverpool."

      /*
      photo:
        "/public/sean.jpeg"
      */

    }

  };



  /* =====================================================
     MASTER PROGRAMME
  ===================================================== */

  const PROGRAMME = [


    /* =================================================
       DAY 1
       7 SEPTEMBER 2026
    ================================================= */


    {
      id:"d1-registration",
      day:1,
      date:"2026-09-07",
      start:"07:30",
      end:"08:30",

      title:"Registration",
      detail:"",
      type:"General",

      feedbackEnabled:false
    },


    {
      id:"d1-opening",
      day:1,
      date:"2026-09-07",
      start:"08:30",
      end:"09:00",

      title:"Opening Ceremony",

      detail:
        "Prof. Datuk Ts. Dr. Shahrin bin Sahib @ Sahibuddin, FASc., Vice-Chancellor, UiTM",

      type:"Ceremony",

      feedbackEnabled:false
    },


    /* =================================================
       OPENING KEYNOTE
    ================================================= */

    {
      id:"d1-opening-keynote",
      day:1,
      date:"2026-09-07",
      start:"09:00",
      end:"10:00",

      title:"Opening Keynote",

      type:"Keynote",

      detail:
        "Prof. Dr. John O. Mason · Stem Cell-derived organoids as tools to understand brain development and diseases",

      room:"Grand Ballroom",

      speakers:[

        {
          presenterId:
            "featured-john-mason",

          name:
            "Prof. Dr. John O. Mason",

          affiliation:
            "University of Edinburgh, United Kingdom",

          presentationTitle:
            "Stem Cell-derived organoids as tools to understand brain development and diseases",

          bioId:
            "featured-john-mason",

          feedbackEnabled:true
        }

      ]
    },


    /* =================================================
       PLENARY 1
    ================================================= */

    {
      id:"d1-plenary1",
      day:1,
      date:"2026-09-07",
      start:"10:00",
      end:"10:30",

      title:"Plenary 1",

      type:"Plenary",

      detail:
        "Dr. Chua Kien Hui · From Fundamental Discovery in Regenerative Medicine to Commercial Impact",

      room:"Grand Ballroom",

      speakers:[

        {
          presenterId:
            "featured-chua-kien-hui",

          name:
            "Dr. Chua Kien Hui",

          affiliation:
            "Supergenics Berhad, Malaysia",

          presentationTitle:
            "From Fundamental Discovery in Regenerative Medicine to Commercial Impact",

          bioId:
            "featured-chua-kien-hui",

          feedbackEnabled:true
        }

      ]
    },


    {
      id:"d1-tea1",
      day:1,
      date:"2026-09-07",
      start:"10:30",
      end:"11:00",

      title:
        "Tea Break, Exhibition & Poster Viewing",

      detail:"",
      type:"Break",

      feedbackEnabled:false
    },



    /* =================================================
       DAY 1 SYMPOSIUM SP1–SP3
    ================================================= */

    {
      id:"d1-symposium123",
      day:1,
      date:"2026-09-07",
      start:"11:00",
      end:"12:15",

      title:"Symposium",

      detail:
        "Three parallel symposium sessions",

      type:"Parallel",

      parallel:[


        /* =============================================
           SP1
        ============================================= */

        {
          id:"d1-s1",

          label:"SP1",

          title:
            "Functional Biomaterials for Regenerative Medicine",

          room:
            "Grand Ballroom",

          chair:
            "Dr. Nur Izzah Md Fadilah",

          chairAffiliation:
            "Department of Tissue Engineering & Regenerative Medicine (DTERM), Faculty of Medicine, UKM",

          peopleLabel:
            "Speakers",

          speakers:[

            {
              presenterId:"sp1-p01",

              name:
                "Prof. Dr. drg. Juni Handajani, M.Kes., PhD",

              affiliation:
                "Faculty of Dentistry, Universitas Gadjah Mada, Indonesia",

              presentationTitle:
                "Therapeutic effects of SHED-conditioned medium on traumatic buccal mucosa ulcers",

              feedbackEnabled:true
            },


            {
              presenterId:"sp1-p02",

              name:
                "Dr. Abdul Manaf Abdullah",

              affiliation:
                "UiTM, Malaysia",

              presentationTitle:
                "Development of Carbon Fiber and Zinc Oxide Reinforced Polyamide 6 Filaments for Enhanced Mechanical, Physical, and Antibacterial Properties for Craniofacial Reconstruction",

              feedbackEnabled:true
            },


            {
              presenterId:"sp1-p03",

              name:
                "Dr Nur Farahiyah Mohammad",

              affiliation:
                "Universiti Malaysia Perlis (UniMAP), Malaysia",

              presentationTitle:
                "Engineering Functional Hydroxyapatite Coatings with Plant-Derived Polyphenols for Bone Regeneration and Orthopedic Implants",

              feedbackEnabled:true
            },


            {
              presenterId:"sp1-p04",

              name:
                "Assistant Professor Chih-Hsin (Melody) Lin",

              affiliation:
                "National Yang Ming Chiao Tung University, Taiwan",

              presentationTitle:
                "A machine learning liver-on-a-chip system for safer drug formulation",

              feedbackEnabled:true
            }

          ]
        },



        /* =============================================
           SP2
        ============================================= */

        {
          id:"d1-s2",

          label:"SP2",

          title:
            "Cell-Free Therapies: Secretome, Exosomes, and Conditioned Media",

          room:
            "Grand Patio",

          chair:
            "Assoc Prof Dr Law Jia Xian",

          chairAffiliation:
            "DTERM, Faculty of Medicine, UKM, Malaysia",

          peopleLabel:
            "Speakers",

          speakers:[

            {
              presenterId:"sp2-p01",

              name:
                "Professor Dr. Norshariza Nordin",

              affiliation:
                "Faculty of Medicine & Health Sciences, Universiti Putra Malaysia",

              presentationTitle:
                "Natural Herb–Primed Neural Stem Cell-Derived Small Extracellular Vesicles Enhance Cross-Species Neurogenesis",

              feedbackEnabled:true
            },


            {
              presenterId:"sp2-p02",

              name:
                "Assoc Prof Dr Yogeswaran Lokanathan",

              affiliation:
                "DTERM, Faculty of Medicine, UKM, Malaysia",

              presentationTitle:
                "3D Bioprinted Genipin-Crosslinked Gelatin Hydrogel with MSC-sEVs for Wound Healing",

              feedbackEnabled:true
            },


            {
              presenterId:"sp2-p03",

              name:
                "Assoc Prof Dr Law Jia Xian",

              affiliation:
                "DTERM, Faculty of Medicine, UKM, Malaysia",

              presentationTitle:
                "Therapeutic potential of mesenchymal stem cell-derived extracellular vesicles in skin diseases",

              feedbackEnabled:true
            },


            {
              presenterId:"sp2-p04",

              name:
                "Dr Maimonah Eissa Al-Masawa",

              affiliation:
                "Department of Pharmaceutical Life Sciences, Faculty of Pharmacy, Universiti Malaya",

              presentationTitle:
                "Extracellular Vesicle Therapy: Promise and Challenges",

              feedbackEnabled:true
            },


            {
              presenterId:"sp2-p05",

              name:
                "Dr. Tan Sik Loo",

              affiliation:
                "Department of Orthopaedic Surgery, Faculty of Medicine, Universiti Malaya, Malaysia",

              presentationTitle:
                "Extracellular Vesicles-Derived MicroRNAs Signatures in Osteoarthritis: Comparative Profiling of Synovial Fluid and Systemic Circulation",

              feedbackEnabled:true
            }

          ]
        },



        /* =============================================
           SP3
        ============================================= */

        {
          id:"d1-s3",

          label:"SP3",

          title:
            "iPSC: Innovations Toward Clinical Translation",

          room:
            "Patio 1",

          chair:
            "Assoc. Prof. Dr. Fazlina Nordin",

          chairAffiliation:
            "DTERM, Faculty of Medicine, UKM",

          peopleLabel:
            "Speakers",

          speakers:[

            {
              presenterId:"sp3-p01",

              name:
                "Prof. Dr. Michael KH Ling",

              affiliation:
                "Faculty of Medicine and Health Sciences, UPM, Malaysia",

              presentationTitle:
                "Neurodevelopmental Dysregulation in Down Syndrome: Mechanistic Insights from Human iPSC-Derived Neural Models",

              feedbackEnabled:true
            },


            {
              presenterId:"sp3-p02",

              name:
                "Dr. Rizal Azis",

              affiliation:
                "Research Center for Biomedical Engineering, Faculty of Engineering, Universitas Indonesia",

              presentationTitle:
                "Generation Of Multiple Cell Types Derived From Hipsc For Multi-Tissue Organoids",

              feedbackEnabled:true
            },


            {
              presenterId:"sp3-p03",

              name:
                "Dr. Zach Pang",

              affiliation:
                "Bioprocessing Technology Institute (BTI), A*STAR, Singapore",

              presentationTitle:
                "iPSC upscaling production and culture media optimization",

              feedbackEnabled:true
            },


            {
              presenterId:"sp3-p04",

              name:
                "Dr. Izyan Mohd Idris",

              affiliation:
                "Institute for Medical Research, National Institutes of Health, Malaysia",

              presentationTitle:
                "From Skin to Synapse: Building Malaysia’s iPSC-Brain Organoid Platform for Rare Disease Discovery at IMR",

              feedbackEnabled:true
            }

          ]
        }

      ]
    },



    /* =================================================
       INDUSTRIAL TALK
    ================================================= */

    {
      id:"d1-industry1",
      day:1,
      date:"2026-09-07",
      start:"12:15",
      end:"12:45",

      title:"Industrial Talk 1",

      type:"Industrial Talk",

      room:"Grand Ballroom",

      detail:
        "Sean Ng See Nguan · Advance Regenerative Medicine Solutions",

      speakers:[

        {
          presenterId:
            "featured-sean-ng",

          name:
            "Sean Ng See Nguan",

          affiliation:
            "Ming Medical Sdn. Bhd., Malaysia",

          presentationTitle:
            "Advance Regenerative Medicine Solutions",

          bioId:
            "featured-sean-ng",

          feedbackEnabled:true
        }

      ]
    },


    {
      id:"d1-lunch",
      day:1,
      date:"2026-09-07",
      start:"12:45",
      end:"14:00",

      title:
        "Lunch, Exhibition & Poster Rapid Presentation",

      detail:"",
      type:"Break",

      feedbackEnabled:false
    },



    /* =================================================
       PROFESSIONAL ORAL PRESENTATION
    ================================================= */

    {
      id:"d1-op",
      day:1,
      date:"2026-09-07",
      start:"14:00",
      end:"15:00",

      title:
        "Oral Presentation — Professional Category",

      detail:
        "Three parallel Professional Oral Presentation themes",

      type:"Parallel",

      parallel:[


        /* =============================================
           PROFESSIONAL THEME 1
        ============================================= */

        {
          id:"d1-op1",

          label:
            "Professional Oral · Theme 1",

          title:
            "Stem Cell Innovations and Clinical Applications",

          room:
            "Grand Ballroom",

          format:
            "8 mins Presentation + 2 min Q&A",

          chair:
            "Dr Adila A Hamid (UKM)",

          judges:[
            "AP. Dr. Wan Safwani Wan Kamarul Zaman (UM)",
            "AP. Dr. Fazlina Nordin (UKM)"
          ],

          peopleLabel:
            "Presenters",

          speakers:[

            {
              presenterId:"d1-op1-p01",

              start:"14:00",
              end:"14:10",

              name:
                "Kistina Mohamed",

              affiliation:
                "Department of Biomedical Sciences, Universiti Malaysia Sabah",

              abstractId:
                "MTERM2026-001040",

              presentationTitle:
                "Characterization of Skeletal Muscle Stem Cell Responses During Dystrophic Muscle Regeneration Using the MDX Mouse Model",

              feedbackEnabled:true
            },


            {
              presenterId:"d1-op1-p02",

              start:"14:10",
              end:"14:20",

              name:
                "Wahyunia Likhayati Septiana",

              affiliation:
                "Department of Histology, Gunadarma University",

              abstractId:
                "MTERM2026-001070",

              presentationTitle:
                "PRP as A Xeno-Free Alternative for Maintaining Stemness in 3D UC-MSC Culture",

              feedbackEnabled:true
            },


            {
              presenterId:"d1-op1-p03",

              start:"14:20",
              end:"14:30",

              name:
                "Shaik Ahmad Kamal Shaik Mohd Fakiruddin",

              affiliation:
                "Hematology Unit, Cancer Research Centre, Institute for Medical Research (IMR)",

              abstractId:
                "MTERM2026-001051",

              presentationTitle:
                "Engineering ACE2- and IL-37-Expressing Mesenchymal Stem Cells for Dual Targeting of SARS-CoV-2 and Acute Respiratory Distress Syndrome (ARDS) in vitro",

              feedbackEnabled:true
            },


            {
              presenterId:"d1-op1-p04",

              start:"14:30",
              end:"14:40",

              name:
                "Carlos Silvester",

              affiliation:
                "Faculty of Medicine and Health Sciences, Universiti Malaysia Sabah",

              abstractId:
                "MTERM2026-001127",

              presentationTitle:
                "An Activin-Enriched Gastric Stromal Clone Promotes Gastric Stem Cell Maintenance",

              feedbackEnabled:true
            },


            {
              presenterId:"d1-op1-p05",

              start:"14:40",
              end:"14:50",

              name:
                "Nurul Ain Nasim Mohd Yusof",

              affiliation:
                "Hematology Unit, Cancer Research Centre, Institute for Medical Research (IMR), Malaysia",

              abstractId:
                "MTERM2026-001154",

              presentationTitle:
                "Building Malaysia's Patient-Specific iPSC-Derived Cardiomyocyte Platform for Precision Cardio-Oncology",

              feedbackEnabled:true
            }

          ]
        },



        /* =============================================
           PROFESSIONAL THEME 2
        ============================================= */

        {
          id:"d1-op2",

          label:
            "Professional Oral · Theme 2",

          title:
            "Biomaterials and Tissue Scaffolds",

          room:
            "Grand Patio",

          format:
            "8 mins Presentation + 2 min Q&A",

          chair:
            "Dr. Nurhaslina Hasan (UiTM)",

          judges:[
            "AP. Dr. Yogeswaran a/l Lokanathan (UKM)",
            "AP. Dr. Khor Goot Heah (UiTM)"
          ],

          peopleLabel:
            "Presenters",

          speakers:[

            {
              presenterId:"d1-op2-p01",

              start:"14:00",
              end:"14:10",

              name:
                "Lim Siew Shee",

              affiliation:
                "Chemical and Environmental Engineering, University of Nottingham Malaysia",

              abstractId:
                "MTERM2026-001027",

              presentationTitle:
                "Chemical-Thermal Crosslinking of Gelatine Membranes for Tunable Degradation and Enhanced HaCaT Cell Adhesion and Migration",

              feedbackEnabled:true
            },


            {
              presenterId:"d1-op2-p02",

              start:"14:10",
              end:"14:20",

              name:
                "Enas Alkhader",

              affiliation:
                "Middle East University",

              abstractId:
                "MTERM2026-001029",

              presentationTitle:
                "Polymeric Nanoparticulate System for The Co-delivery of Curcumin and 5-Flurouracil for The Potential Colorectal Cancer Treatment",

              feedbackEnabled:true
            },


            {
              presenterId:"d1-op2-p03",

              start:"14:20",
              end:"14:30",

              name:
                "Ch. Tri Nuryana",

              affiliation:
                "Anatomy, Universitas Gadjah Mada",

              abstractId:
                "MTERM2026-001131",

              presentationTitle:
                "Achatina Fulica Mucus Inhibits Premature Aging of Human Skin Fibroblasts by Decreasing miR-23a Expression",

              feedbackEnabled:true
            },


            {
              presenterId:"d1-op2-p04",

              start:"14:30",
              end:"14:40",

              name:
                "Amira Raudhah Abdullah",

              affiliation:
                "Anatomy, Universiti Sains Islam Malaysia",

              abstractId:
                "MTERM2026-001077",

              presentationTitle:
                "The Effects of Dual Growth Factor and Bisphosphonate-Loaded Hydroxyapatite (HA) Scaffold in Rat Critical-Sized Femoral Defect Model",

              feedbackEnabled:true
            }

          ]
        },



        /* =============================================
           PROFESSIONAL THEME 3
        ============================================= */

        {
          id:"d1-op3",

          label:
            "Professional Oral · Theme 3",

          title:
            "Extracellular Vesicle and Disease Remodeling",

          room:
            "Patio 1",

          format:
            "8 mins Presentation + 2 min Q&A",

          chair:
            "Dr. Muhammad Fauzi Daud (UniKL)",

          judges:[
            "Prof. Dr. Norshariza Nordin (UPM)",
            "AP. Dr. Nur Aliana Hidayah binti Mohamed (UiTM)"
          ],

          peopleLabel:
            "Presenters",

          speakers:[

            {
              presenterId:"d1-op3-p01",

              start:"14:00",
              end:"14:10",

              name:
                "Ng Sook Luan",

              affiliation:
                "Department of Craniofacial Diagnostics and Bioscience, Faculty of Dentistry, Universiti Kebangsaan Malaysia",

              abstractId:
                "MTERM2026-001135",

              presentationTitle:
                "Human Platelet-Derived Extracellular Vesicles Attenuate Alveolar Bone Loss in Ligature-Induced Periodontitis",

              feedbackEnabled:true
            },


            {
              presenterId:"d1-op3-p02",

              start:"14:10",
              end:"14:20",

              name:
                "Ratih Yuniartha",

              affiliation:
                "Anatomi, Universitas Gadjah Mada",

              abstractId:
                "MTERM2026-001136",

              presentationTitle:
                "Therapeutic Effects of MSC-Derived Exosomes in the Chronic Phase of Renal Ischemia–Reperfusion Injury",

              feedbackEnabled:true
            },


            {
              presenterId:"d1-op3-p03",

              start:"14:20",
              end:"14:30",

              name:
                "Siti Aminah Muhammad Imran",

              affiliation:
                "Ming Medical Sdn. Bhd.",

              abstractId:
                "MTERM2026-001098",

              presentationTitle:
                "Longevity: Elongating The Telomere Through Exosomes",

              feedbackEnabled:true
            },


            {
              presenterId:"d1-op3-p04",

              start:"14:30",
              end:"14:40",

              name:
                "Desy Armalina",

              affiliation:
                "Medicine, Universitas Diponegoro",

              abstractId:
                "MTERM2026-001034",

              presentationTitle:
                "Banana Peel-Based Cookies Exhibit Antihyperglycemic and Pancreatic Protective Properties in Diabetic Mice Induced by Streptozotocin: A Comprehensive Analysis of Sensory Acceptability and Histopathological Findings",

              feedbackEnabled:true
            },


            {
              presenterId:"d1-op3-p05",

              start:"14:40",
              end:"14:50",

              name:
                "Maizatul Fazilah Abdul Razak",

              affiliation:
                "Faculty of Medicine and Health Sciences, Universiti Malaysia Sarawak",

              abstractId:
                "MTERM2026-001134",

              presentationTitle:
                "Advances in human brain organoids for Alzheimer's disease modelling",

              feedbackEnabled:true
            }

          ]
        }

      ]
    },


    {
      id:"d1-tea2",
      day:1,
      date:"2026-09-07",
      start:"15:00",
      end:"15:10",

      title:
        "Tea Break, Exhibition & Poster Viewing",

      type:"Break",

      feedbackEnabled:false
    },



    /* =================================================
       SYIS
    ================================================= */

    {
      id:"d1-syis",
      day:1,
      date:"2026-09-07",
      start:"15:10",
      end:"16:30",

      title:
        "Student and Young Investigator Symposium",

      detail:
        "Three parallel SYIS presentation themes",

      type:"Parallel",

      parallel:[


        /* =============================================
           SYIS THEME 1
        ============================================= */

        {
          id:"d1-syis1",

          label:
            "SYIS · Theme 1",

          title:
            "Stem Cell Innovations and Clinical Applications",

          room:
            "Grand Ballroom",

          format:
            "8 mins Presentation + 2 min Q&A",

          chair:
            "Dr Rahayu Zulkapli (UiTM)",

          judges:[
            "AP. Dr. Nur Aliana Hidayah binti Mohamed (UiTM)",
            "Dr. Ng Sook Luan (UKM)"
          ],

          peopleLabel:
            "Presenters",

          speakers:[

            {
              presenterId:"d1-syis1-p01",
              start:"15:10",
              end:"15:20",

              name:
                "Kalaiselvaan Thanaskody",

              affiliation:
                "Department of Tissue Engineering & Regenerative Medicine (DTERM), Universiti Kebangsaan Malaysia (UKM)",

              abstractId:
                "MTERM2026-001105",

              presentationTitle:
                "Efficiency and Stability of NILV Versus Conventional Lentiviral System Using PGK-GFP and Reprogramming Factor Constructs",

              feedbackEnabled:true
            },


            {
              presenterId:"d1-syis1-p02",
              start:"15:20",
              end:"15:30",

              name:
                "Siti Zawiah Abdul Malik",

              affiliation:
                "Department of Tissue Engineering and Regenerative Medicine, Universiti Kebangsaan Malaysia",

              abstractId:
                "MTERM2026-001113",

              presentationTitle:
                "Differential Effects of Oxygen Tension on iPSC Function and Exosome Production",

              feedbackEnabled:true
            },


            {
              presenterId:"d1-syis1-p03",
              start:"15:30",
              end:"15:40",

              name:
                "Nur Dina Muhammad Fuad",

              affiliation:
                "Department of Tissue Engineering and Regenerative Medicine (DTERM), Universiti Kebangsaan Malaysia (UKM)",

              abstractId:
                "MTERM2026-001114",

              presentationTitle:
                "Phoenixin as a Therapeutic Modulator of Neurodegenerative Disease Progression",

              feedbackEnabled:true
            },


            {
              presenterId:"d1-syis1-p04",
              start:"15:40",
              end:"15:50",

              name:
                "Narmadaa Raman",

              affiliation:
                "Department of Tissue Engineering and Regenerative Medicine, Universiti Kebangsaan Malaysia",

              abstractId:
                "MTERM2026-001115",

              presentationTitle:
                "Beyond Wharton’s Jelly: Defining Optimal Perinatal Mesenchymal Stem Cell (MSC) Sources for Regenerative Medicine",

              feedbackEnabled:true
            },


            {
              presenterId:"d1-syis1-p05",
              start:"15:50",
              end:"16:00",

              name:
                "Khalisa Husna Kahar",

              affiliation:
                "Department of Tissue Engineering & Regenerative Medicine, Universiti Kebangsaan Malaysia",

              abstractId:
                "MTERM2026-001132",

              presentationTitle:
                "Optimization and Validation of Lentiviral Reprogramming Constructs for Endometriosis Patient-Derived iPSCs",

              feedbackEnabled:true
            },


            {
              presenterId:"d1-syis1-p06",
              start:"16:00",
              end:"16:10",

              name:
                "Suganthy Kumar",

              affiliation:
                "Department of Tissue Engineering and Regenerative Medicine, National University of Malaysia",

              abstractId:
                "MTERM2026-001035",

              presentationTitle:
                "Repeated High-Dose Wharton’s Jelly Mesenchymal Stromal Cells Extend Survival and Preserve Locomotion in Advanced Ageing",

              feedbackEnabled:true
            },


            {
              presenterId:"d1-syis1-p07",
              start:"16:10",
              end:"16:20",

              name:
                "Hew Wen Xiao",

              affiliation:
                "Sunway University",

              abstractId:
                "MTERM2026-001042",

              presentationTitle:
                "WJ-MSC-Derived Extracellular Vesicles Facilitate Diabetic Wound Repair via Inflammatory Modulation, Angiogenesis, and Matrix Remodeling",

              feedbackEnabled:true
            }

          ]
        },



        /* =============================================
           SYIS THEME 2
        ============================================= */

        {
          id:"d1-syis2",

          label:
            "SYIS · Theme 2",

          title:
            "Hydrogels and Biomaterials",

          room:
            "Grand Patio",

          format:
            "8 mins Presentation + 2 min Q&A",

          chair:
            "Dr. Izyan Hazwani Binti Baharuddin (UiTM)",

          judges:[
            "AP. Dr. Law Jia Xian (UKM)",
            "Dr. Muhammad Fauzi Daud (UniKL)"
          ],

          peopleLabel:
            "Presenters",

          speakers:[

            {
              presenterId:"d1-syis2-p01",
              start:"15:10",
              end:"15:20",

              name:
                "Raniya Adiba Mohd Razif",

              affiliation:
                "DTERM, Universiti Kebangsaan Malaysia",

              abstractId:
                "MTERM2026-001076",

              presentationTitle:
                "3D-Printed Gelatin Scaffolds Loaded with Kelulut Honey and Asiaticoside for Wound Healing",

              feedbackEnabled:true
            },


            {
              presenterId:"d1-syis2-p02",
              start:"15:20",
              end:"15:30",

              name:
                "Sushmitha Rajeev Kumar",

              affiliation:
                "Faculty of Pharmacy, Department of Pharmaceutical Life Sciences, Universiti Malaya",

              abstractId:
                "MTERM2026-001046",

              presentationTitle:
                "Improving Wound Healing with Curcumin-Infused Topical Hydrogels",

              feedbackEnabled:true
            },


            {
              presenterId:"d1-syis2-p03",
              start:"15:30",
              end:"15:40",

              name:
                "Wafa Ali",

              affiliation:
                "Physiology, Universiti Kebangsaan Malaysia",

              abstractId:
                "MTERM2026-001050",

              presentationTitle:
                "Genipin-Crosslinked Gelatin/PVA Hydrogels for Cartilage Tissue Engineering: Fabrication, Characterization, and Chondrocyte Biocompatibility",

              feedbackEnabled:true
            },


            {
              presenterId:"d1-syis2-p04",
              start:"15:40",
              end:"15:50",

              name:
                "Nurul Ain Ahmad Zawawi",

              affiliation:
                "Department of Tissue Engineering & Regenerative Medicine, Universiti Kebangsaan Malaysia",

              abstractId:
                "MTERM2026-001052",

              presentationTitle:
                "Evaluating a Novel Genipin-Crosslinked Hydrogel for Atopic Dermatitis in In Vitro and In Vivo Models",

              feedbackEnabled:true
            },


            {
              presenterId:"d1-syis2-p05",
              start:"15:50",
              end:"16:00",

              name:
                "Andik Nisa Zahra Binti Zainuddin",

              affiliation:
                "Department of Tissue Engineering and Regenerative Medicine (DTERM), Universiti Kebangsaan Malaysia",

              abstractId:
                "MTERM2026-001057",

              presentationTitle:
                "Characterisation of Kelulut Honey-Loaded Injectable Gelatin–PVA-nanoCollagen–Graphene Oxide Hydrogel",

              feedbackEnabled:true
            }

          ]
        },



        /* =============================================
           SYIS THEME 3
        ============================================= */

        {
          id:"d1-syis3",

          label:
            "SYIS · Theme 3",

          title:
            "Innovations in Bioscaffolds for Tissue Engineering",

          room:
            "Patio 1",

          format:
            "8 mins Presentation + 2 min Q&A",

          chair:
            "Dr Siti Aminah Muhammad Imran (UKM/Ming Medical Sdn. Bhd.)",

          judges:[
            "AP. Dr. Fazlina Nordin (UKM)",
            "Dr Zatilfarihiah Rasdi (UiTM)"
          ],

          peopleLabel:
            "Presenters",

          speakers:[

            {
              presenterId:"d1-syis3-p01",
              start:"15:10",
              end:"15:20",

              name:
                "Nur Syamimi Ahmad Zaini",

              affiliation:
                "Faculty of Dentistry, Universiti Teknologi MARA",

              abstractId:
                "MTERM2026-001139",

              presentationTitle:
                "Design of Experiment-Based Optimisation of Hydroxychloroquine-Loaded PLGA Microparticles Fabrication",

              feedbackEnabled:true
            },


            {
              presenterId:"d1-syis3-p02",
              start:"15:20",
              end:"15:30",

              name:
                "Muhammad Harriz Iskandar bin Yusri",

              affiliation:
                "Pharmaceutical Life Science, Universiti Malaya",

              abstractId:
                "MTERM2026-001126",

              presentationTitle:
                "An Ontology-Aware Computational Workflow for Exploratory Mapping of Cardiac Bioscaffold Design for Cardiac Tissue Engineering Application",

              feedbackEnabled:true
            },


            {
              presenterId:"d1-syis3-p03",
              start:"15:30",
              end:"15:40",

              name:
                "Lim Fang",

              affiliation:
                "Department of Tissue Engineering and Regenerative Medicine, Universiti Kebangsaan Malaysia",

              abstractId:
                "MTERM2026-001059",

              presentationTitle:
                "Sequence Length-Dependent Peptide Effects on Hyperglycaemia-Induced Dermal Fibroblasts",

              feedbackEnabled:true
            },


            {
              presenterId:"d1-syis3-p04",
              start:"15:40",
              end:"15:50",

              name:
                "Ahmad Khairul Aizad Ahmad Khairi",

              affiliation:
                "Department of Biomedical Science, Universiti Putra Malaysia",

              abstractId:
                "MTERM2026-001048",

              presentationTitle:
                "Evaluation of Cold-Water Fish Skin Gelatin as a Substrate for Enhanced 2D Adhesion Kinetics and 3D Plant-Based Scaffolding of Primary Ovine Fibroblasts",

              feedbackEnabled:true
            },


            {
              presenterId:"d1-syis3-p05",
              start:"15:50",
              end:"16:00",

              name:
                "Nur Farhana binti Said",

              affiliation:
                "Faculty of Dentistry, UiTM",

              abstractId:
                "MTERM2026-001028",

              presentationTitle:
                "Synthesis and Characterization of PLGA-CQD Fluorescent Nanoprobes for Future Lateral Flow Assay Applications",

              feedbackEnabled:true
            },


            {
              presenterId:"d1-syis3-p06",
              start:"16:00",
              end:"16:10",

              name:
                "Nur Aifa Asyhira Khairul Nizam",

              affiliation:
                "DTERM, Universiti Kebangsaan Malaysia",

              abstractId:
                "MTERM2026-001053",

              presentationTitle:
                "Bioprinted Gelatin-SIKVAV and Gelatin-Palmitoyl-GDPH Bioinks Promote Skin Regeneration: In Vivo and In Vitro Assessment",

              feedbackEnabled:true
            }

          ]
        }

      ]
    },



    /* =================================================
       PLENARY 2
    ================================================= */

    {
      id:"d1-plenary2",
      day:1,
      date:"2026-09-07",
      start:"16:30",
      end:"17:00",

      title:"Plenary 2",

      type:"Plenary",

      room:"Grand Ballroom",

      detail:
        "Prof. Dr. Ika Dewi Ana · Preventing biofilm formation and reducing persistent infections associated with indwelling scaffolds",

      speakers:[

        {
          presenterId:
            "featured-ika-dewi-ana",

          name:
            "Prof. Dr. Ika Dewi Ana",

          affiliation:
            "Universitas Gadjah Mada, Indonesia",

          presentationTitle:
            "Preventing biofilm formation and reducing persistent infections associated with indwelling scaffolds",

          bioId:
            "featured-ika-dewi-ana",

          feedbackEnabled:true
        }

      ]
    },



    /* =================================================
       KEYNOTE TALK
    ================================================= */

    {
      id:"d1-keynote2",
      day:1,
      date:"2026-09-07",
      start:"17:00",
      end:"18:00",

      title:"Keynote Talk",

      type:"Keynote",

      room:"Grand Ballroom",

      detail:
        "Prof. Amin Tamadon · From Discovery to Therapy: Building a National ATMP and Mesenchymal Stromal Cell-Derived Extracellular Vesicle Platform in Kazakhstan—Opportunities for Malaysia–Kazakhstan Collaboration",

      speakers:[

        {
          presenterId:
            "featured-amin-tamadon",

          name:
            "Prof. Amin Tamadon",

          affiliation:
            "West Kazakhstan Marat Ospanov Medical University, Kazakhstan",

          presentationTitle:
            "From Discovery to Therapy: Building a National ATMP and Mesenchymal Stromal Cell-Derived Extracellular Vesicle Platform in Kazakhstan—Opportunities for Malaysia–Kazakhstan Collaboration",

          bioId:
            "featured-amin-tamadon",

          feedbackEnabled:true
        }

      ]
    },


    {
      id:"d1-adjourn",
      day:1,
      date:"2026-09-07",
      start:"18:00",
      end:"18:01",

      title:"Adjourn Day 1",

      detail:"",
      type:"General",

      feedbackEnabled:false
    },



    /* =================================================
       DAY 2
       8 SEPTEMBER 2026
    ================================================= */


    {
      id:"d2-registration",
      day:2,
      date:"2026-09-08",
      start:"08:30",
      end:"09:00",

      title:"Registration",

      detail:"",
      type:"General",

      feedbackEnabled:false
    },



    /* =================================================
       PLENARY 3
    ================================================= */

    {
      id:"d2-plenary3",
      day:2,
      date:"2026-09-08",
      start:"09:00",
      end:"09:30",

      title:"Plenary 3",

      type:"Plenary",

      room:"Grand Ballroom",

      detail:
        "Prof. Dr. Kyung-Soon Park · 3D-Printed Patient-Specific Implants for Reconstruction of Massive Acetabular Defects in Revision Total Hip Arthroplasty",

      speakers:[

        {
          presenterId:
            "featured-kyung-soon-park",

          name:
            "Prof. Dr. Kyung-Soon Park",

          affiliation:
            "Chonnam National University Hwasun Hospital, South Korea",

          presentationTitle:
            "3D-Printed Patient-Specific Implants for Reconstruction of Massive Acetabular Defects in Revision Total Hip Arthroplasty",

          bioId:
            "featured-kyung-soon-park",

          feedbackEnabled:true
        }

      ]
    },



    /* =================================================
       DISTINGUISHED EXPERT FORUM
    ================================================= */

    {
      id:"d2-forum",
      day:2,
      date:"2026-09-08",
      start:"09:30",
      end:"10:45",

      title:"Distinguished Expert Forum",

      type:"Forum",

      room:"Grand Ballroom",

      detail:
        "Bridging Discovery to Delivery: Translating Regenerative Science into Clinical and Commercial Reality",

      moderator:
        "Assoc. Prof. Dr. Ng Min Hwei",

      /*
        Forum panel members are listed for programme
        information.

        They are NOT duplicated as separate feedback
        targets here because they already have featured
        keynote/plenary feedback records.
      */

      panel:[

        "Prof. Dr. John O. Mason",
        "Prof. Dr. Bassem Sadek",
        "Dr. Chua Kien Hui",
        "Prof. Amin Tamadon",
        "Prof. Dr. Ika Dewi Ana",
        "Prof. Dr. Kyung-Soon Park"

      ]
    },


    {
      id:"d2-tea1",
      day:2,
      date:"2026-09-08",
      start:"10:45",
      end:"11:00",

      title:
        "Tea Break, Exhibition & Poster Viewing",

      detail:"",
      type:"Break",

      feedbackEnabled:false
    },



    /* =================================================
       DAY 2 SYMPOSIUM SP4–SP6
    ================================================= */

    {
      id:"d2-s456",
      day:2,
      date:"2026-09-08",
      start:"11:00",
      end:"12:15",

      title:"Symposium",

      detail:
        "Three parallel symposium sessions",

      type:"Parallel",

      parallel:[


        /* =============================================
           SP4
        ============================================= */

        {
          id:"d2-s4",

          label:"SP4",

          title:
            "Translational Biofabrication in Regenerative Medicine: Bridging Cells, Biomaterials, and Clinical Applications",

          room:
            "Grand Ballroom",

          chair:
            "Assoc. Prof. Dr Nur Aliana Hidayah Mohamed",

          chairAffiliation:
            "Faculty of Dentistry, Universiti Teknologi MARA",

          peopleLabel:
            "Speakers",

          speakers:[

            {
              presenterId:"sp4-p01",

              name:
                "Assoc. Prof. Dr. Nurulhuda Mohd",

              affiliation:
                "Department of Restorative Dentistry, Faculty of Dentistry, UKM",

              presentationTitle:
                "In Vivo Evaluation of a 3D-Bioprinted Gelatin-Hydroxyapatite Scaffold for Periodontal Tissue Regeneration in a Rat Model",

              feedbackEnabled:true
            },


            {
              presenterId:"sp4-p02",

              name:
                "Prof. Dr. Masfueh Razali",

              affiliation:
                "Department of Restorative Dentistry, Faculty of Dentistry, UKM",

              presentationTitle:
                "Angiogenic signaling molecules in periodontal regeneration: A scoping review",

              feedbackEnabled:true
            },


            {
              presenterId:"sp4-p03",

              name:
                "Dr. Nurul Aida Ngah",

              affiliation:
                "Centre of Oral and Maxillofacial Surgery Studies, Faculty of Dentistry, UiTM",

              presentationTitle:
                "Engineering a Bioactive Lyophilised Platelet-Rich Fibrin–Based Scaffold for Craniofacial Bone Regeneration",

              feedbackEnabled:true
            },


            {
              presenterId:"sp4-p04",

              name:
                "Associate Prof Ts Dr Nur Aliana Hidayah Mohamed",

              affiliation:
                "Faculty of Dentistry, Universiti Teknologi MARA, Malaysia",

              presentationTitle:
                "Titanium Dioxide Nanotube and Pluronic F127-Enhanced Simvastatin-Loaded Porous Microsphere Scaffolds with Improved Mechanical Properties for Bone Regeneration",

              feedbackEnabled:true
            },


            {
              presenterId:"sp4-p05",

              name:
                "Dr. Apt. Febri Annuryanti",

              affiliation:
                "Faculty of Pharmacy, Universitas Airlangga, Surabaya, Indonesia",

              presentationTitle:
                "Advanced 3D-Printed Ocular Implants for Long-Acting Glaucoma Therapy",

              feedbackEnabled:true
            }

          ]
        },



        /* =============================================
           SP5
        ============================================= */

        {
          id:"d2-s5",

          label:"SP5",

          title:
            "TERM Research",

          room:
            "Grand Patio",

          chair:
            "Dr. Izyan Mohd Idris",

          chairAffiliation:
            "Institut Penyelidikan Perubatan (IMR)",

          peopleLabel:
            "Speakers",

          speakers:[

            {
              presenterId:"sp5-p01",

              name:
                "Prof. Kai-Chiang YANG",

              affiliation:
                "Taipei Medical University",

              presentationTitle:
                "Engineering Fibrotic Microenvironments for Tissue Regeneration Using MicroRNA-Loaded Chitosan Nanocomplexes",

              feedbackEnabled:true
            },


            {
              presenterId:"sp5-p02",

              name:
                "Dr. Wiwit Ananda Wahyu Setyaningsih",

              affiliation:
                "Department of Anatomy, Faculty of Medicine, Universitas Gadjah Mada, Indonesia",

              presentationTitle:
                "HDAC11–STAT3 axis drives infection-induced endothelial inflammation and dysfunction in diabetic iPS-ECs",

              feedbackEnabled:true
            },


            {
              presenterId:"sp5-p03",

              name:
                "Dr. Muhammad Fauzi Daud",

              affiliation:
                "Universiti Kuala Lumpur - Institute of Medical Science Technology",

              presentationTitle:
                "Engineering Artificial Tissue Through Innovative 3D Cell Culture Mode",

              feedbackEnabled:true
            },


            {
              presenterId:"sp5-p04",

              name:
                "Prof. Wei-Jen Chang",

              affiliation:
                "School of Dentistry, College of Oral Medicine, Taipei Medical University",

              presentationTitle:
                "Precision Bone Regeneration in Implant Dentistry",

              feedbackEnabled:true
            }

          ]
        },



        /* =============================================
           SP6
        ============================================= */

        {
          id:"d2-s6",

          label:"SP6",

          title:
            "Vascular Regenerative and Reparative Medicine - A Frontier",

          room:
            "Patio 1",

          chair:
            "Dr. Farina Mohamad Yusoff",

          chairAffiliation:
            "Hiroshima University, Japan",

          peopleLabel:
            "Speakers",

          speakers:[

            {
              presenterId:"sp6-p01",

              name:
                "Professor Yukihito Higashi (MD, PhD, FAHA, FJSH)",

              affiliation:
                "Research Institute for Radiation Biology and Medicine, Hiroshima University, Hiroshima, Japan",

              presentationTitle:
                "Therapeutic Angiogenesis",

              feedbackEnabled:true
            },


            {
              presenterId:"sp6-p02",

              name:
                "Dr. Masato Kajikawa (MD, PhD)",

              affiliation:
                "Medical Center for Translational and Clinical Research, Hiroshima University Hospital, Hiroshima, Japan",

              presentationTitle:
                "State-of-the-art Cell Processing Room at Hiroshima University Hospital for Regenerative Medicine",

              feedbackEnabled:true
            },


            {
              presenterId:"sp6-p03",

              name:
                "Ts. Dr. Nor Azfa Johari (PhD)",

              affiliation:
                "Malaysia Genome and Vaccine Institute, National Institutes of Biotechnology Malaysia, Kajang, Malaysia",

              presentationTitle:
                "Potential of Proteomics in Determining Therapeutic Molecular Characteristics for Tissue Regeneration",

              feedbackEnabled:true
            },


            {
              presenterId:"sp6-p04",

              name:
                "Dr. Tetsuya Yoshimoto (DDD, PhD)",

              affiliation:
                "Center for Oral Clinical Examination, Hiroshima University Hospital, Hiroshima, Japan",

              presentationTitle:
                "Vascular Stabilization as a Strategy to Prevent Bone Loss: Insights from Low-intensity Pulsed Ultrasound (LIPUS) under Unloading Model",

              feedbackEnabled:true
            },


            {
              presenterId:"sp6-p05",

              name:
                "Dr. Farina Mohamad Yusoff (MBBS, PhD, FSVM)",

              affiliation:
                "Research Institute for Radiation Biology and Medicine, Hiroshima University, Hiroshima, Japan",

              presentationTitle:
                "Paradigm Shift for Vascular Regeneration in Regenerative Medicine",

              feedbackEnabled:true
            }

          ]
        }

      ]
    },


    {
      id:"d2-agm",
      day:2,
      date:"2026-09-08",
      start:"12:15",
      end:"13:15",

      title:
        "22nd TESMA Annual General Meeting (AGM) 2026",

      type:"Meeting",

      feedbackEnabled:false
    },


    {
      id:"d2-lunch",
      day:2,
      date:"2026-09-08",
      start:"13:15",
      end:"14:00",

      title:
        "Lunch, Exhibition & Poster Viewing",

      type:"Break",

      feedbackEnabled:false
    },



    /* =================================================
       DAY 2 SYMPOSIUM SP7–SP9
    ================================================= */

    {
      id:"d2-s789",
      day:2,
      date:"2026-09-08",
      start:"14:00",
      end:"15:15",

      title:"Symposium",

      detail:
        "Three parallel symposium sessions",

      type:"Parallel",

      parallel:[


        /* =============================================
           SP7
        ============================================= */

        {
          id:"d2-s7",

          label:"SP7",

          title:
            "Nerve & Skin Regeneration",

          room:
            "Grand Ballroom",

          chair:
            "Dr. Nur Atiqah Haizum Abdullah",

          chairAffiliation:
            "DTERM, Faculty of Medicine, UKM",

          peopleLabel:
            "Speakers",

          speakers:[

            {
              presenterId:"sp7-p01",

              name:
                "Assoc. Prof. Dr. Tan Suat Cheng",

              affiliation:
                "School of Health Sciences, Health Campus, USM",

              presentationTitle:
                "Transcriptome Analysis of Ischemic Stroke Recovery Induced by Neural Stem Cell Preconditioned with Baicalein-Enriched Fraction of Oroxylum Indicum",

              feedbackEnabled:true
            },


            {
              presenterId:"sp7-p02",

              name:
                "Dr. Nur Atiqah Haizum Abdullah",

              affiliation:
                "DTERM, Faculty of Medicine, UKM",

              presentationTitle:
                "Development of an In Vitro Parkinson’s Disease Model Using Differentiated SH-SY5Y Cells for Phoenixin Characterization",

              feedbackEnabled:true
            },


            {
              presenterId:"sp7-p03",

              name:
                "Dr. Nur 'Izzati Binti Mansor",

              affiliation:
                "Nursing Department, Faculty of Medicine, UKM",

              presentationTitle:
                "Development of In Vitro Neurodegenerative Models Using Stem Cell-Derived Neural Cells for Natural Product Screening",

              feedbackEnabled:true
            },


            {
              presenterId:"sp7-p04",

              name:
                "Dr. Nur Izzah Md Fadilah",

              affiliation:
                "DTERM, Faculty of Medicine, UKM, Malaysia",

              presentationTitle:
                "Evaluation of Hyaluronic Acid-Based 3D Printable Hydrogel as a Bioink for Skin Tissue Engineering",

              feedbackEnabled:true
            }

          ]
        },



        /* =============================================
           SP8
        ============================================= */

        {
          id:"d2-s8",

          label:"SP8",

          title:
            "Smart Technology for Medical Applications",

          room:
            "Grand Patio",

          chair:
            "Ts. Dr. Noor Badariah Asan",

          chairAffiliation:
            "Faculty of Electronics and Computer Engineering, Universiti Teknikal Malaysia Melaka (UTeM)",

          peopleLabel:
            "Speakers",

          speakers:[

            {
              presenterId:"sp8-p01",

              name:
                "Assoc. Prof. Dr. Mohamad Zoinol Abidin bin Abd Aziz",

              affiliation:
                "Universiti Teknikal Malaysia Melaka (UTeM)",

              presentationTitle:
                "High directive microwave sensor",

              feedbackEnabled:true
            },


            {
              presenterId:"sp8-p02",

              name:
                "Ts. Dr. Abd Shukur bin Ja’afar",

              affiliation:
                "Universiti Teknikal Malaysia Melaka (UTeM)",

              presentationTitle:
                "Advances in AI-Driven Microwave Technologies for Skin Wound Classification and Monitoring",

              feedbackEnabled:true
            },


            {
              presenterId:"sp8-p03",

              name:
                "Ir. Ts. Dr. Noor Badariah binti Asan",

              affiliation:
                "Universiti Teknikal Malaysia Melaka (UTeM)",

              presentationTitle:
                "Characterization of the Dielectric Properties of Normal Mouse Tissues and Organs",

              feedbackEnabled:true
            },


            {
              presenterId:"sp8-p04",

              name:
                "Assoc Prof. Dr Nurul Huda binti Abd Rahman",

              affiliation:
                "Universiti Teknologi MARA (UiTM)",

              presentationTitle:
                "From Beam Steering to Body Sensing: Advanced Lens and Planar Antenna Technologies for Next-Generation Biomedical Applications",

              feedbackEnabled:true
            },


            {
              presenterId:"sp8-p05",

              name:
                "Assoc Prof. Robin Augustine",

              affiliation:
                "Uppsala University, Sweden",

              presentationTitle:
                "A Non-Invasive Microwave Sensor for Cerebrospinal Fluid Detection in a Layered Head Phantom / Floating Microwave Resonator for CSF-Sensitive Cranial Phantom Monitoring",

              feedbackEnabled:true
            }

          ]
        },



        /* =============================================
           SP9
        ============================================= */

        {
          id:"d2-s9",

          label:"SP9",

          title:
            "Bridging the Gap from Innovation to Clinical Translation in Emerging Cell Therapies",

          room:
            "Patio 1",

          chair:
            "Dr. Adila A. Hamid",

          chairAffiliation:
            "Physiology Department, Faculty of Medicine, UKM",

          peopleLabel:
            "Speakers",

          speakers:[

            {
              presenterId:"sp9-p01",

              name:
                "Dr Abid Nordin",

              affiliation:
                "Medcentral Consulting",

              presentationTitle:
                "From NCEs to CGTPs: A CRO Perspective on Regulatory Challenges in Emerging Therapies",

              feedbackEnabled:true
            },


            {
              presenterId:"sp9-p02",

              name:
                "Assoc. Prof. Dr. Fazlina Nordin",

              affiliation:
                "DTERM, Faculty of Medicine, UKM, Malaysia",

              presentationTitle:
                "Enhancing MSC Therapeutic Potential Through Hypoxia and IFN-γ Priming for Mitochondrial Disease",

              feedbackEnabled:true
            },


            {
              presenterId:"sp9-p03",

              name:
                "Dr. Manira Maarof",

              affiliation:
                "DTERM, Faculty of Medicine, UKM",

              presentationTitle:
                "Clinical translational research: UKM GMP Experience",

              feedbackEnabled:true
            },


            {
              presenterId:"sp9-p04",

              name:
                "Dr Woo Jun Yung",

              affiliation:
                "AGeM Bio, Singapore",

              presentationTitle:
                "Engineering MSC 2.0: An Integrated Platform for Next-Generation MSC Therapeutics",

              feedbackEnabled:true
            },


            {
              presenterId:"sp9-p05",

              name:
                "Assoc. Dr. Norashikin M. Thamrin",

              affiliation:
                "Microwave Research Institute (MRI), Universiti Teknologi MARA, Shah Alam, Malaysia",

              presentationTitle:
                "Can Robots Help the Human Body Heal? Intelligent Sensing, AI and Automation for Regenerative Medicine",

              feedbackEnabled:true
            }

          ]
        }

      ]
    },


    {
      id:"d2-tea2",
      day:2,
      date:"2026-09-08",
      start:"15:15",
      end:"15:45",

      title:
        "Tea Break, Exhibition & Poster Viewing",

      detail:"",
      type:"Break",

      feedbackEnabled:false
    },



    /* =================================================
       CLOSING KEYNOTE
    ================================================= */

    {
      id:"d2-closing-keynote",
      day:2,
      date:"2026-09-08",
      start:"15:45",
      end:"16:45",

      title:"Closing Keynote",

      type:"Keynote",

      room:"Grand Ballroom",

      detail:
        "Prof. Dr. Bassem Shaban Sadek · Nanoparticle-Enabled Biomaterials: Translating Nanoengineered Platforms from Discovery to Regenerative Therapy",

      speakers:[

        {
          presenterId:
            "featured-bassem-sadek",

          name:
            "Prof. Dr. Bassem Shaban Sadek",

          affiliation:
            "United Arab Emirates University, United Arab Emirates",

          presentationTitle:
            "Nanoparticle-Enabled Biomaterials: Translating Nanoengineered Platforms from Discovery to Regenerative Therapy",

          bioId:
            "featured-bassem-sadek",

          feedbackEnabled:true
        }

      ]
    },


    {
      id:"d2-closing",
      day:2,
      date:"2026-09-08",
      start:"16:45",
      end:"17:15",

      title:
        "Closing and Award Giving Ceremony",

      detail:"",
      type:"Ceremony",

      feedbackEnabled:false
    },


    {
      id:"d2-end",
      day:2,
      date:"2026-09-08",
      start:"17:15",
      end:"17:16",

      title:
        "End of MTERMS 2026",

      detail:"",
      type:"General",

      feedbackEnabled:false
    }

  ];



  /* =====================================================
     HELPERS FOR V2

     These helpers prevent the participant/admin pages
     from having to duplicate programme logic.
  ===================================================== */


  function getProgramme(){

    return PROGRAMME;

  }



  function getFeaturedBios(){

    return FEATURED_BIOS;

  }



  function getProgrammeForDay(day){

    return PROGRAMME.filter(
      item =>
        item.day === Number(day)
    );

  }



  function getSessionById(sessionId){

    for(const item of PROGRAMME){

      if(item.id === sessionId){
        return item;
      }


      if(
        Array.isArray(item.parallel)
      ){

        const found =
          item.parallel.find(
            session =>
              session.id === sessionId
          );


        if(found){

          return {
            ...found,

            parentId:
              item.id,

            day:
              item.day,

            date:
              item.date,

            start:
              item.start,

            end:
              item.end,

            parentTitle:
              item.title
          };

        }

      }

    }


    return null;

  }



  function getAllSessions(){

    const sessions = [];


    PROGRAMME.forEach(item => {

      if(
        Array.isArray(item.parallel)
      ){

        item.parallel.forEach(
          session => {

            sessions.push({

              ...session,

              parentId:
                item.id,

              day:
                item.day,

              date:
                item.date,

              start:
                item.start,

              end:
                item.end,

              parentTitle:
                item.title

            });

          }
        );


      }else{

        sessions.push(item);

      }

    });


    return sessions;

  }



  function getAllFeedbackPresenters(){

    const people = [];


    PROGRAMME.forEach(item => {


      /*
        Normal keynote / plenary /
        industrial session speakers.
      */

      if(
        Array.isArray(item.speakers)
      ){

        item.speakers.forEach(
          speaker => {

            if(
              speaker.feedbackEnabled ===
              false
            ){
              return;
            }


            people.push({

              ...speaker,

              sessionId:
                item.id,

              parentId:
                item.id,

              day:
                item.day,

              date:
                item.date,

              sessionStart:
                item.start,

              sessionEnd:
                item.end,

              room:
                item.room || "",

              sessionTitle:
                item.title,

              sessionLabel:
                item.title,

              category:
                item.type

            });

          }
        );

      }



      /*
        SP / Professional Oral / SYIS
        parallel sessions.
      */

      if(
        Array.isArray(item.parallel)
      ){

        item.parallel.forEach(
          session => {


            (
              session.speakers ||
              []
            )
            .forEach(
              speaker => {

                if(
                  speaker.feedbackEnabled ===
                  false
                ){
                  return;
                }


                people.push({

                  ...speaker,

                  sessionId:
                    session.id,

                  parentId:
                    item.id,

                  day:
                    item.day,

                  date:
                    item.date,

                  sessionStart:
                    item.start,

                  sessionEnd:
                    item.end,

                  room:
                    session.room || "",

                  sessionTitle:
                    session.title,

                  sessionLabel:
                    session.label,

                  category:
                    item.id ===
                    "d1-op"
                      ? "Professional Oral"
                      : (
                          item.id ===
                          "d1-syis"
                            ? "SYIS"
                            : "Symposium"
                        )

                });

              }
            );

          }
        );

      }

    });


    return people;

  }



  function getPresenterById(
    presenterId
  ){

    return (
      getAllFeedbackPresenters()
        .find(
          person =>
            person.presenterId ===
            presenterId
        ) ||
      null
    );

  }



  function getDiscussionRoomDefinitions(){

    const rooms = [];


    PROGRAMME.forEach(item => {


      /*
        Each parallel track gets its
        existing discussion-room ID.
      */

      if(
        Array.isArray(item.parallel)
      ){

        item.parallel.forEach(
          session => {

            rooms.push({

              id:
                session.id,

              parentId:
                item.id,

              day:
                item.day,

              date:
                item.date,

              start:
                item.start,

              end:
                item.end,

              room:
                session.room || "",

              label:
                session.label,

              title:
                session.label +
                " — " +
                session.title

            });

          }
        );


        return;

      }



      /*
        Preserve existing single-session
        discussion rooms.
      */

      if(
        [
          "Keynote",
          "Plenary",
          "Industrial Talk",
          "Forum"
        ]
        .includes(
          item.type
        )
      ){

        rooms.push({

          id:
            item.id,

          parentId:
            item.id,

          day:
            item.day,

          date:
            item.date,

          start:
            item.start,

          end:
            item.end,

          room:
            item.room || "",

          label:
            item.title,

          title:
            item.title

        });

      }

    });


    return rooms;

  }



  function searchProgramme(
    query
  ){

    const value =
      String(
        query || ""
      )
      .trim()
      .toLowerCase();


    if(!value){

      return PROGRAMME;

    }


    return PROGRAMME.filter(
      item => {

        let text =
          [
            item.title,
            item.detail,
            item.type,
            item.room
          ]
          .filter(Boolean)
          .join(" ");


        (
          item.speakers ||
          []
        )
        .forEach(
          speaker => {

            text +=
              " " +
              [
                speaker.name,
                speaker.affiliation,
                speaker.presentationTitle
              ]
              .filter(Boolean)
              .join(" ");

          }
        );


        (
          item.parallel ||
          []
        )
        .forEach(
          session => {

            text +=
              " " +
              [
                session.label,
                session.title,
                session.room,
                session.chair,
                session.chairAffiliation,
                ...(session.judges || [])
              ]
              .filter(Boolean)
              .join(" ");


            (
              session.speakers ||
              []
            )
            .forEach(
              speaker => {

                text +=
                  " " +
                  [
                    speaker.name,
                    speaker.affiliation,
                    speaker.presentationTitle,
                    speaker.abstractId
                  ]
                  .filter(Boolean)
                  .join(" ");

              }
            );

          }
        );


        return text
          .toLowerCase()
          .includes(value);

      }
    );

  }



  /* =====================================================
     EXPOSE TO THE V2 PARTICIPANT / ADMIN PAGES
  ===================================================== */

  window.MTERMS_PROGRAMME_V2 = {

    version:
      "2.0",

    event:{
      name:
        "MTERMS 2026",

      fullName:
        "10th Malaysian Tissue Engineering & Regenerative Medicine Scientific Meeting",

      theme:
        "From Discovery to Therapy: Advances in Tissue Engineering and Regenerative Medicine",

      startDate:
        "2026-09-07",

      endDate:
        "2026-09-08",

      timezone:
        "Asia/Kuala_Lumpur",

      timezoneLabel:
        "UTC+8",

      venue:
        "Concorde Hotel Shah Alam"
    },


    programme:
      PROGRAMME,


    featuredBios:
      FEATURED_BIOS,


    getProgramme,

    getFeaturedBios,

    getProgrammeForDay,

    getSessionById,

    getAllSessions,

    getAllFeedbackPresenters,

    getPresenterById,

    getDiscussionRoomDefinitions,

    searchProgramme

  };


  /* =====================================================
     DEVELOPMENT CHECK

     This does not alter the page.
     It simply makes validation easier
     in browser Developer Console.
  ===================================================== */

  console.log(
    "MTERMS Programme V2 loaded:",
    {
      programmeItems:
        PROGRAMME.length,

      feedbackPresenters:
        getAllFeedbackPresenters()
          .length,

      discussionRooms:
        getDiscussionRoomDefinitions()
          .length
    }
  );


})();
