const API =
  'https://mterm2026-559f9bf571b5.herokuapp.com';

const ADMIN_KEY =
  'mterms-admin-basic';


let allParticipants = [];
let filteredParticipants = [];
let selectedParticipants = new Map();
let participantPhotoUrls = new Map();

const PHOTO_ADJUSTMENT_KEY =
  'mterms-id-card-photo-adjustments';

let photoAdjustments = loadSavedPhotoAdjustments();

let activePhotoDrag = null;


const $ = id =>
  document.getElementById(id);

function loadSavedPhotoAdjustments(){

  try{

    const raw =
      localStorage.getItem(
        PHOTO_ADJUSTMENT_KEY
      );

    if(!raw){
      return {};
    }

    const parsed =
      JSON.parse(raw);

    return parsed &&
      typeof parsed === 'object'
        ? parsed
        : {};

  }catch(error){

    console.warn(
      'Could not load saved photo adjustments.',
      error
    );

    return {};

  }

}


function savePhotoAdjustments(){

  try{

    localStorage.setItem(
      PHOTO_ADJUSTMENT_KEY,
      JSON.stringify(
        photoAdjustments
      )
    );

  }catch(error){

    console.warn(
      'Could not save photo adjustments.',
      error
    );

  }

}


function getPhotoAdjustment(id){

  if(
    !photoAdjustments[id]
  ){

    photoAdjustments[id] = {
      x:0,
      y:0,
      zoom:1
    };

  }

  return photoAdjustments[id];

}



function applyPhotoAdjustment(id){

  const adjustment =
    getPhotoAdjustment(id);


  const images =
    document.querySelectorAll(
      `[data-adjusted-photo="${CSS.escape(id)}"]`
    );


  images.forEach(
    image => {

      image.style.transform =
        `translate(
          calc(-50% + ${adjustment.x}px),
          calc(-50% + ${adjustment.y}px)
        )
        scale(${adjustment.zoom})`;

    }
  );


  const zoomLabels =
    document.querySelectorAll(
      `[data-zoom-label="${CSS.escape(id)}"]`
    );


  zoomLabels.forEach(
    label => {

      label.textContent =
        `${Math.round(
          adjustment.zoom * 100
        )}%`;

    }
  );

}


function authHeader(){

  const token =
    localStorage.getItem(ADMIN_KEY);

  return token
    ? {
        Authorization:
          'Basic ' + token
      }
    : {};
}


function escapeHtml(value){

  return String(value ?? '')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'","&#039;");
}


function fullName(doc){

  return [
    doc?.personal?.firstName || '',
    doc?.personal?.lastName || ''
  ]
    .join(' ')
    .trim();
}

function hasProfilePhoto(participant){

  const uploads =
    Array.isArray(
      participant?.uploads
    )
      ? participant.uploads
      : [];


  return uploads.some(
    upload =>
      upload?.type ===
      'profilePhoto'
  );

}

/* =========================================================
   LOAD ALL PARTICIPANTS
   ========================================================= */

async function fetchParticipantPage(page){

  const response =
    await fetch(
      `${API}/api/admin/registrations?page=${page}&limit=100&q=`,
      {
        headers:
          authHeader()
      }
    );


  const data =
    await response
      .json()
      .catch(() => ({}));


  if(!response.ok){

    throw new Error(
      data.error ||
      `HTTP ${response.status}`
    );

  }


  return data;
}


async function loadAllParticipants(){

  if(
    !localStorage.getItem(
      ADMIN_KEY
    )
  ){

    alert(
      'Please login through admin.html first.'
    );

    window.location.href =
      'admin.html';

    return;
  }


  $('participantList').innerHTML =
    `
      <div class="loading-message">
        Loading participants...
      </div>
    `;


  allParticipants = [];


  try{

    let page = 1;
    let total = 0;


    while(true){

      const data =
        await fetchParticipantPage(page);


      const rows =
        Array.isArray(data.rows)
          ? data.rows
          : [];


      total =
        Number(
          data.total || 0
        );


      allParticipants.push(
        ...rows
      );


      if(
        !rows.length ||
        allParticipants.length >= total
      ){
        break;
      }


      page += 1;

    }


    populateCategoryFilter();

    applyFilters();


  }catch(error){

    $('participantList').innerHTML =
      `
        <div class="loading-message">
          ❌ ${escapeHtml(error.message)}
        </div>
      `;

  }

}


/* =========================================================
   FILTERS
   ========================================================= */

function populateCategoryFilter(){

  const categories =
    [
      ...new Set(
        allParticipants
          .map(
            participant =>
              participant.category || ''
          )
          .filter(Boolean)
      )
    ]
      .sort();


  $('categoryFilter').innerHTML =
    `
      <option value="">
        All Categories
      </option>
    ` +
    categories
      .map(
        category =>
          `
            <option value="${escapeHtml(category)}">
              ${escapeHtml(category)}
            </option>
          `
      )
      .join('');

}


function applyFilters(){

  const search =
    $('searchBox')
      .value
      .trim()
      .toLowerCase();


  const category =
    $('categoryFilter')
      .value;


  const payment =
    $('paymentFilter')
      .value;

  const photoStatus =
  $('photoFilter')
    .value;

  filteredParticipants =
    allParticipants.filter(
      participant => {

        const searchableText =
          [
            participant.regCode,
            fullName(participant),
            participant?.personal?.email,
            participant?.professional?.affiliation,
            participant.category
          ]
            .join(' ')
            .toLowerCase();


        const matchSearch =
          !search ||
          searchableText.includes(
            search
          );


        const matchCategory =
          !category ||
          participant.category ===
            category;


        const paymentStatus =
          String(
            participant
              ?.payment
              ?.status ||
            'pending'
          )
            .toLowerCase();


        const matchPayment =
          !payment ||
          paymentStatus ===
            payment;

        const participantHasPhoto =
  hasProfilePhoto(
    participant
  );


const matchPhoto =
  !photoStatus ||

  (
    photoStatus ===
      'uploaded' &&
    participantHasPhoto
  ) ||

  (
    photoStatus ===
      'missing' &&
    !participantHasPhoto
  );

        return (
  matchSearch &&
  matchCategory &&
  matchPayment &&
  matchPhoto
);

      }
    );


  renderParticipantList();

  updateSummary();

}


/* =========================================================
   PARTICIPANT SELECTOR
   ========================================================= */

function renderParticipantList(){

  if(
    !filteredParticipants.length
  ){

    $('participantList').innerHTML =
      `
        <div class="empty-state">
          No participants found.
        </div>
      `;

    return;

  }


  $('participantList').innerHTML =
    filteredParticipants
      .map(
        participant => {

          const id =
            String(
              participant._id
            );


          const checked =
            selectedParticipants
              .has(id);

          const photoUploaded =
  hasProfilePhoto(
    participant
  );


const photoClass =
  photoUploaded
    ? 'photo-uploaded'
    : 'photo-missing';


const photoStatusText =
  photoUploaded
    ? '✓ Photo Uploaded'
    : 'No Photo';


          return `
            <label class="participant-item ${photoClass}">

              <input
                type="checkbox"
                class="participant-checkbox"
                data-id="${escapeHtml(id)}"
                ${checked ? 'checked' : ''}>

              <div class="participant-main">

                <div class="participant-name">
                  ${escapeHtml(
                    fullName(
                      participant
                    )
                  )}
                </div>

                <div class="participant-code">
                  ${escapeHtml(
                    participant.regCode || ''
                  )}
                </div>

                <div class="participant-detail">
                  ${escapeHtml(
                    participant
                      ?.professional
                      ?.affiliation ||
                    ''
                  )}
                </div>

                <div class="participant-detail">
                  ${escapeHtml(
                    participant.category ||
                    ''
                  )}
                </div>

                <div
  class="photo-status-badge ${
    photoUploaded
      ? 'uploaded'
      : 'missing'
  }">

  ${photoStatusText}

</div>

              </div>

            </label>
          `;

        }
      )
      .join('');

}


/* =========================================================
   SELECTION
   ========================================================= */

$('participantList')
  .addEventListener(
    'change',
    event => {

      const checkbox =
        event.target.closest(
          '.participant-checkbox'
        );


      if(!checkbox){
        return;
      }


      const id =
        checkbox.dataset.id;


      const participant =
        allParticipants.find(
          row =>
            String(row._id) === id
        );


      if(!participant){
        return;
      }


      if(
        checkbox.checked
      ){

        selectedParticipants
          .set(
            id,
            participant
          );

      }else{

        selectedParticipants
          .delete(id);

      }


      updateSummary();

      renderCardWorkspace();

    }
  );


/* =========================================================
   CARD WORKSPACE
   ========================================================= */

function pickLatestPhoto(rows){

  if(
    !Array.isArray(rows) ||
    rows.length === 0
  ){
    return null;
  }


  return rows
    .slice()
    .sort(
      (a,b) => {

        const versionA =
          Number(a.version) || 0;

        const versionB =
          Number(b.version) || 0;


        if(
          versionB !== versionA
        ){
          return versionB - versionA;
        }


        const timeA =
          new Date(
            a.uploadedAt || 0
          ).getTime();


        const timeB =
          new Date(
            b.uploadedAt || 0
          ).getTime();


        return timeB - timeA;

      }
    )[0];

}

async function loadParticipantPhoto(
  participant
){

  const id =
    String(
      participant._id
    );


  const frame =
    document.querySelector(
      `[data-photo-frame="${CSS.escape(id)}"]`
    );


  if(!frame){
    return;
  }


  const regCode =
    participant.regCode || '';


  const email =
    participant
      ?.personal
      ?.email || '';


  if(
    !regCode ||
    !email
  ){

    frame.innerHTML =
      `
        <div class="photo-loading">
          No registration code or email.
        </div>
      `;

    return;

  }


  try{

    const response =
      await fetch(
        `${API}/api/uploads/history?regCode=${encodeURIComponent(regCode)}&email=${encodeURIComponent(email)}&type=profilePhoto`,
        {
          cache:'no-store'
        }
      );


    const data =
      await response
        .json()
        .catch(() => ({}));


    if(!response.ok){

      throw new Error(
        data.error ||
        `HTTP ${response.status}`
      );

    }


    const rows =
      Array.isArray(data.rows)
        ? data.rows
        : [];


    const latest =
      pickLatestPhoto(rows);


    if(!latest){

      frame.innerHTML =
        `
          <div class="photo-loading">
            No photo uploaded
          </div>
        `;

      return;

    }


    const photoUrl =
      `${API}${latest.downloadUrl}`;


    participantPhotoUrls.set(
  id,
  photoUrl
);


frame.innerHTML =
  `
    <img
      class="id-card-photo"
      src="${escapeHtml(photoUrl)}"
      alt="${escapeHtml(fullName(participant))}"
      draggable="false"
      data-photo-id="${escapeHtml(id)}"
      data-adjusted-photo="${escapeHtml(id)}">
  `;

  applyPhotoAdjustment(id);


  }catch(error){

    console.error(
      'Photo load failed:',
      participant.regCode,
      error
    );


    frame.innerHTML =
      `
        <div class="photo-loading photo-error">
          Photo failed to load
        </div>
      `;

  }

}
async function renderCardWorkspace(){
  
  const selected =
    [
      ...selectedParticipants
        .values()
    ];


  if(
    !selected.length
  ){

    $('cardWorkspace').innerHTML =
      `
        <div class="empty-state">
          Select participants above
          to prepare ID cards.
        </div>
      `;


    $('a4Pages').innerHTML =
      '';


    updateSummary();

    return;

  }


  /* 1. Create the ID cards first */
  $('cardWorkspace').innerHTML =
    selected
      .map(
        participant =>
          createCardEditor(
            participant
          )
      )
      .join('');


  /* 2. Now load each participant's latest photo */
await Promise.all(
  selected.map(
    participant =>
      loadParticipantPhoto(
        participant
      )
  )
);


/* 3. Build the A4 preview */
renderA4Pages();

}

function createCardEditor(
  participant
){

  const name =
    fullName(
      participant
    );


  const affiliation =
    participant
      ?.professional
      ?.affiliation ||
    participant
      ?.student
      ?.university ||
    '';


  const category =
    participant.category ||
    'Participant';


  return `
    <div
      class="badge-editor"
      data-registration-id="${escapeHtml(
        participant._id
      )}">

      <div class="badge-editor-title">
        ${escapeHtml(name)}
      </div>


      <div class="id-card">

        <div class="id-card-branding">

          <img
            class="id-card-mterms"
            src="public/mterm.jpg"
            alt="MTERMS">


          <div class="id-card-orgs">

            <img
              src="public/uitm.png"
              alt="UiTM">

            <img
              src="public/tesma.png"
              alt="TESMA">

          </div>

        </div>


<div
  class="id-card-photo-frame"
  data-photo-frame="${escapeHtml(participant._id)}">

  <div
    class="photo-loading"
    data-photo-loading="${escapeHtml(participant._id)}">
    Loading photo...
  </div>

</div>


        <div class="id-card-info">

          <div class="id-card-name">
            ${escapeHtml(name)}
          </div>

          <div class="id-card-affiliation">
            ${escapeHtml(
              affiliation
            )}
          </div>

          <div class="id-card-category">
            ${escapeHtml(
              category
                .toUpperCase()
            )}
          </div>

        </div>


        <div class="id-card-footer">
          MTERMS 2026
        </div>

      </div>


<div
  class="photo-controls"
  data-controls-id="${escapeHtml(participant._id)}">

  <div class="photo-instruction">
    Drag the photo directly inside the frame to reposition it.
  </div>


  <div class="control-row">

    <button
      type="button"
      class="btn btn-secondary photo-control-btn"
      data-photo-action="zoom-out"
      data-id="${escapeHtml(participant._id)}">
      − Zoom
    </button>


    <span
      class="zoom-value"
      data-zoom-label="${escapeHtml(participant._id)}">
      100%
    </span>


    <button
      type="button"
      class="btn btn-secondary photo-control-btn"
      data-photo-action="zoom-in"
      data-id="${escapeHtml(participant._id)}">
      + Zoom
    </button>


    <button
      type="button"
      class="btn btn-secondary photo-control-btn"
      data-photo-action="reset"
      data-id="${escapeHtml(participant._id)}">
      Reset
    </button>

  </div>

</div>

    </div>
  `;

}


/* =========================================================
   PHOTO ADJUSTMENT CONTROLS
   ========================================================= */

$('cardWorkspace')
  .addEventListener(
    'click',
    event => {

      const button =
        event.target.closest(
          '[data-photo-action]'
        );


      if(!button){
        return;
      }


      const id =
        button.dataset.id;

      const action =
        button.dataset.photoAction;


      if(!id){
        return;
      }


      const adjustment =
        getPhotoAdjustment(id);


      if(
        action ===
        'zoom-in'
      ){

        adjustment.zoom =
          Math.min(
            2.5,
            adjustment.zoom + 0.05
          );

      }


      if(
        action ===
        'zoom-out'
      ){

        adjustment.zoom =
          Math.max(
            0.5,
            adjustment.zoom - 0.05
          );

      }


      if(
        action ===
        'reset'
      ){

        adjustment.x = 0;
        adjustment.y = 0;
        adjustment.zoom = 1;

      }


      savePhotoAdjustments();

      applyPhotoAdjustment(id);

    }
  );

$('cardWorkspace')
  .addEventListener(
    'pointerdown',
    event => {

      const frame =
        event.target.closest(
          '.id-card-photo-frame'
        );


      if(!frame){
        return;
      }


      const image =
        frame.querySelector(
          '.id-card-photo'
        );


      if(!image){
        return;
      }


      const id =
        image.dataset.photoId;


      if(!id){
        return;
      }


      event.preventDefault();


      const adjustment =
        getPhotoAdjustment(id);


      activePhotoDrag = {

        id,

        startPointerX:
          event.clientX,

        startPointerY:
          event.clientY,

        startImageX:
          adjustment.x,

        startImageY:
          adjustment.y

      };


      frame.classList.add(
        'dragging'
      );


      if(
        frame.setPointerCapture
      ){

        try{

          frame.setPointerCapture(
            event.pointerId
          );

        }catch(error){
          // Safari may ignore this.
        }

      }

    }
  );

document.addEventListener(
  'pointermove',
  event => {

    if(
      !activePhotoDrag
    ){
      return;
    }


    const id =
      activePhotoDrag.id;


    const adjustment =
      getPhotoAdjustment(id);


    adjustment.x =
      activePhotoDrag.startImageX +
      (
        event.clientX -
        activePhotoDrag.startPointerX
      );


    adjustment.y =
      activePhotoDrag.startImageY +
      (
        event.clientY -
        activePhotoDrag.startPointerY
      );


    applyPhotoAdjustment(id);

  }
);

document.addEventListener(
  'pointerup',
  () => {

    if(
      !activePhotoDrag
    ){
      return;
    }


    savePhotoAdjustments();


    document
      .querySelectorAll(
        '.id-card-photo-frame.dragging'
      )
      .forEach(
        frame =>
          frame.classList.remove(
            'dragging'
          )
      );


    activePhotoDrag =
      null;

  }
);

/* =========================================================
   A4 PLACEHOLDER
   ========================================================= */

function createPrintableCard(
  participant
){

  const id =
    String(
      participant._id
    );


  const name =
    fullName(
      participant
    );


  const affiliation =
    participant
      ?.professional
      ?.affiliation ||
    participant
      ?.student
      ?.university ||
    '';


  const category =
    participant.category ||
    'Participant';


  const photoUrl =
    participantPhotoUrls
      .get(id);


  const photoHtml =
    photoUrl
      ? `
          <img
            class="id-card-photo"
            src="${escapeHtml(photoUrl)}"
            alt="${escapeHtml(name)}"
            draggable="false"
            data-adjusted-photo="${escapeHtml(id)}">
        `
      : `
          <div class="photo-loading">
            No photo
          </div>
        `;


  return `
    <div class="id-card">

      <div class="id-card-branding">

        <img
          class="id-card-mterms"
          src="public/mterm.jpg"
          alt="MTERMS">


        <div class="id-card-orgs">

          <img
            src="public/uitm.png"
            alt="UiTM">

          <img
            src="public/tesma.png"
            alt="TESMA">

        </div>

      </div>


      <div class="id-card-photo-frame">

        ${photoHtml}

      </div>


      <div class="id-card-info">

        <div class="id-card-name">
          ${escapeHtml(name)}
        </div>


        <div class="id-card-affiliation">
          ${escapeHtml(
            affiliation
          )}
        </div>


        <div class="id-card-category">
          ${escapeHtml(
            category.toUpperCase()
          )}
        </div>

      </div>


      <div class="id-card-footer">
        MTERMS 2026
      </div>

    </div>
  `;

}

function renderA4Pages(){

  const selected =
    [
      ...selectedParticipants
        .values()
    ];


  const pages = [];


  for(
    let index = 0;
    index < selected.length;
    index += 9
  ){

    pages.push(
      selected.slice(
        index,
        index + 9
      )
    );

  }


  $('a4Pages').innerHTML =
    pages
      .map(
        (pageRows,pageIndex) => {

          return `
            <div
              class="a4-page"
              data-page="${pageIndex + 1}">

              ${pageRows
                .map(
                  participant =>
                    `
                      <div
                        class="print-card-slot">

                        ${createPrintableCard(
                          participant
                        )}

                      </div>
                    `
                )
                .join('')}

            </div>
          `;

        }
      )
      .join('');


  selected.forEach(
    participant => {

      applyPhotoAdjustment(
        String(
          participant._id
        )
      );

    }
  );


  updateSummary();

}


/* =========================================================
   SUMMARY
   ========================================================= */

function updateSummary(){

  $('totalLoaded')
    .textContent =
      allParticipants.length;


  $('totalShowing')
    .textContent =
      filteredParticipants.length;


  $('totalSelected')
    .textContent =
      selectedParticipants.size;


  $('totalPages')
    .textContent =
      Math.ceil(
        selectedParticipants.size /
        9
      );

}


/* =========================================================
   BUTTONS
   ========================================================= */

$('selectVisibleBtn')
  .addEventListener(
    'click',
    () => {

      filteredParticipants
        .forEach(
          participant => {

            selectedParticipants
              .set(
                String(
                  participant._id
                ),
                participant
              );

          }
        );


      renderParticipantList();

      renderCardWorkspace();

      updateSummary();

    }
  );


$('clearSelectionBtn')
  .addEventListener(
    'click',
    () => {

      selectedParticipants
        .clear();


      renderParticipantList();

      renderCardWorkspace();

      updateSummary();

    }
  );


$('reloadBtn')
  .addEventListener(
    'click',
    loadAllParticipants
  );


$('searchBox')
  .addEventListener(
    'input',
    applyFilters
  );


$('categoryFilter')
  .addEventListener(
    'change',
    applyFilters
  );


$('paymentFilter')
  .addEventListener(
    'change',
    applyFilters
  );

$('photoFilter')
  .addEventListener(
    'change',
    applyFilters
  );

$('previewPrintBtn')
  .addEventListener(
    'click',
    () => {

      $('printPreviewSection')
        .scrollIntoView({
          behavior:'smooth'
        });

    }
  );


$('printPdfBtn')
  .addEventListener(
    'click',
    () => {

      if(
        !selectedParticipants.size
      ){

        alert(
          'Please select at least one participant.'
        );

        return;

      }


      window.print();

    }
  );


/* =========================================================
   INITIAL LOAD
   ========================================================= */

loadAllParticipants();
