/* ==========================================
   MTERMS2026 — Shared Q&A Knowledge Base
   Used by ALL pages that include this file.
   ========================================== */

(function () {
  // Links confirmed from your index.html nav:
  // HOME, THEME, PROGRAM, SPEAKERS, VENUE, REGISTRATION section, AUTHORS PDFs + deadlines,
  // SPONSORS, COMMITTEE, TRAVEL pages, CONTACT. :contentReference[oaicite:1]{index=1}

  window.MTERMS_AI_LINKS = {
    home: "index.html",
    theme: "theme.html",
    program: "program.html",
    speakers: "speaker.html",
    venue: "venue.html",
    sponsors: "sponsors.html",
    committee: "committee.html",
    deadlines: "deadlines.html",
    getting_there: "gettingthere.html",
    accommodation: "accomodation.html",
    destinations: "destinations.html",
    restaurants: "restaurants.html",
    contact: "contact.html",
    login: "login.html",
    admin: "admin.html",
    // Your Register button points to this external registration page. :contentReference[oaicite:2]{index=2}
    register_external: "https://www.mterms2026.com/register.html",

    // Author resources (PDFs) from AUTHORS dropdown. :contentReference[oaicite:3]{index=3}
    author_guidelines_pdf: "public/author%20guidelines.pdf",
    abstract_guidelines_pdf: "public/ABSTRACT%20GUIDELINES%20MTERMS2026_FINALR3.pdf",
    extended_abstract_pdf: "public/extendedabstract.pdf",
    oral_poster_guidelines_pdf: "public/ORAL%20GUIDELINES%20MTERMS2026%20edited_FINAL.pdf"
  };

  // Builder attribution (you asked for this):
  window.MTERMS_AI_BUILDER = {
    name: "IgniteInno Ventures",
    website: "https://igniteinnov.com",
    logo: "public/logo-white.png"
  };

  // Expand this array anytime. All pages will instantly use the new knowledge.
  window.MTERMS_AI_QA = [
    {
      id: "greeting",
      title: "Greeting",
      text:
        "Hi. How are you today? I’m here to help with MTERMS 2026 — program, venue, deadlines, registration, authors, and travel info.",
      tags: "hi hello hey good morning good afternoon good evening how are you help"
    },

    // Core conference info (from your page content and existing FAQ)
    {
      id: "venue",
      title: "Venue & location",
      text: "Venue: Concorde Hotel, Shah Alam, Selangor, Malaysia.",
      tags: "venue location hotel where shah alam concorde selangor",
      linkKey: "venue"
    },
    {
      id: "dates",
      title: "Conference dates",
      text: "Conference dates: 7 & 8 September 2026.",
      tags: "date dates when september 2026 7 8",
      linkKey: "program"
    },
    {
      id: "registration_open",
      title: "Registration",
      text:
        "Registration is open. You can register using the registration page. If you already registered, you can log in to the Participant Portal.",
      tags: "register registration sign up signup payment fees price cost",
      linkKey: "register_external"
    },
    {
      id: "participant_portal",
      title: "Participant Portal (Login)",
      text: "You can access the Participant Portal from the login page.",
      tags: "login participant portal sign in account",
      linkKey: "login"
    },
    {
      id: "admin_login",
      title: "Admin Login",
      text: "Admin access is on the Admin Login page.",
      tags: "admin login staff organizer",
      linkKey: "admin"
    },

    // Deadlines / authors
    {
      id: "deadlines",
      title: "Important Deadlines",
      text:
        "You can view the important deadlines on the Important Deadlines page.",
      tags: "deadline deadlines important dates due date timeline",
      linkKey: "deadlines"
    },
    {
      id: "author_guidelines",
      title: "Author Guidelines",
      text: "You can download the Author Guidelines PDF from the Authors section.",
      tags: "author guidelines paper manuscript instructions",
      linkKey: "author_guidelines_pdf"
    },
    {
      id: "abstract_guidelines",
      title: "Abstract Guidelines and Template",
      text:
        "You can download the Abstract Guidelines and Template PDF from the Authors section.",
      tags: "abstract template guidelines submit submission",
      linkKey: "abstract_guidelines_pdf"
    },
    {
      id: "extended_abstract",
      title: "Extended Abstract Guidelines and Template",
      text:
        "You can download the Extended Abstract Guidelines and Template PDF from the Authors section.",
      tags: "extended abstract template guidelines",
      linkKey: "extended_abstract_pdf"
    },
    {
      id: "oral_poster_guidelines",
      title: "Poster and Oral Guidelines",
      text:
        "You can download the Poster and Oral Guidelines PDF from the Authors section.",
      tags: "poster oral presentation guidelines slide",
      linkKey: "oral_poster_guidelines_pdf"
    },

    // Program / speakers / travel pages
    {
      id: "program",
      title: "Program",
      text: "You can view the latest program on the Program page.",
      tags: "program agenda schedule timetable sessions",
      linkKey: "program"
    },
    {
      id: "speakers",
      title: "Speakers",
      text: "You can view confirmed speakers on the Speakers page.",
      tags: "speaker speakers keynote plenary invited",
      linkKey: "speakers"
    },
    {
      id: "getting_there",
      title: "Getting There",
      text: "Travel info is available on the Getting There page.",
      tags: "getting there how to go direction transport travel",
      linkKey: "getting_there"
    },
    {
      id: "accommodation",
      title: "Nearby Accommodations",
      text: "Hotel recommendations are on the Nearby Accommodations page.",
      tags: "accommodation hotel stay nearby lodging",
      linkKey: "accommodation"
    },
    {
      id: "destinations",
      title: "Must Visit Destinations",
      text: "Tourist spots are listed on the Must Visit Destinations page.",
      tags: "tourism destinations places to visit must visit",
      linkKey: "destinations"
    },
    {
      id: "restaurants",
      title: "Popular Restaurants",
      text: "Food suggestions are on the Popular Restaurants page.",
      tags: "restaurants food makan eat places",
      linkKey: "restaurants"
    },
    {
      id: "contact",
      title: "Contact",
      text: "If you need help, please contact the team via the Contact page or email admin@mterms2026.com.",
      tags: "contact email help admin",
      linkKey: "contact"
    },

    // Friendly off-topic handling (you requested this)
    {
      id: "offtopic",
      title: "Off-topic questions",
      text:
        "I can help with that too. If you also need MTERMS 2026 info, tell me whether you’re looking for the program, venue, deadlines, registration, or author guidelines.",
      tags: "joke weather food advice relationship life question not related"
    }
  ];
})();
