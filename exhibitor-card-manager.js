/* =========================================================
   MTERMS 2026
   EXHIBITOR ID CARD PRINT MANAGER
   ========================================================= */

const STORAGE_KEY =
  'mterms2026-exhibitor-card-list';


let allExhibitors =
  loadExhibitors();


let filteredExhibitors = [];

let selectedExhibitors =
  new Map();


let editingExhibitorId =
  null;


const $ = id =>
  document.getElementById(id);


/* =========================================================
   BASIC HELPERS
   ========================================================= */

function escapeHtml(value){

  return String(value ?? '')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'","&#039;");

}


function createId(){

  return (
    'EXH-' +
    Date.now() +
    '-' +
    Math.random()
      .toString(36)
      .slice(2,8)
  );

}


/* =========================================================
   LOCAL STORAGE
   ========================================================= */

function loadExhibitors(){

  try{

    const raw =
      localStorage.getItem(
        STORAGE_KEY
      );


    if(!raw){
      return [];
    }


    const parsed =
      JSON.parse(raw);


    return Array.isArray(parsed)
      ? parsed
      : [];

  }catch(error){

    console.warn(
      'Could not load exhibitors.',
      error
    );

    return [];

  }

}


function saveExhibitors(){

  try{

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(
        allExhibitors
      )
    );

  }catch(error){

    console.warn(
      'Could not save exhibitors.',
      error
    );

  }

}


/* =========================================================
   EXHIBITOR TYPE
   ========================================================= */

function getEnteredType(){

  const selectedType =
    $('exhibitorType').value;


  if(
    selectedType ===
    'Others'
  ){

    return $('exhibitorOtherType')
      .value
      .trim();

  }


  return selectedType;

}


function handleTypeSelection(){

  const isOther =
    $('exhibitorType').value ===
    'Others';


  $('otherTypeWrapper')
    .classList
    .toggle(
      'show',
      isOther
    );


  if(!isOther){

    $('exhibitorOtherType')
      .value = '';

  }

}


/* =========================================================
   FORM
   ========================================================= */

function resetForm(){

  $('exhibitorName')
    .value = '';


  $('exhibitorCompany')
    .value = '';


  $('exhibitorDesignation')
    .value = '';


  $('exhibitorType')
    .value = 'Exhibitor';


  $('exhibitorOtherType')
    .value = '';


  $('otherTypeWrapper')
    .classList
    .remove('show');


  editingExhibitorId =
    null;


  $('editingNotice')
    .hidden = true;


  $('addExhibitorBtn')
    .textContent =
      '+ Add Exhibitor';

}


function addOrUpdateExhibitor(){

  const name =
    $('exhibitorName')
      .value
      .trim();


  const company =
    $('exhibitorCompany')
      .value
      .trim();


  const designation =
    $('exhibitorDesignation')
      .value
      .trim();


  const type =
    getEnteredType();


  if(!name){

    alert(
      'Please enter the exhibitor name.'
    );

    $('exhibitorName').focus();

    return;

  }


  if(!company){

    alert(
      'Please enter the company / organisation.'
    );

    $('exhibitorCompany').focus();

    return;

  }


  if(!type){

    alert(
      'Please enter the exhibitor type.'
    );

    if(
      $('exhibitorType').value ===
      'Others'
    ){

      $('exhibitorOtherType')
        .focus();

    }

    return;

  }


  if(editingExhibitorId){

    const exhibitor =
      allExhibitors.find(
        row =>
          row.id ===
          editingExhibitorId
      );


    if(exhibitor){

      exhibitor.name =
        name;

      exhibitor.company =
        company;

      exhibitor.designation =
        designation;

      exhibitor.type =
        type;

    }

  }else{

    allExhibitors.push({

      id:
        createId(),

      name,

      company,

      designation,

      type,

      createdAt:
        new Date()
          .toISOString()

    });

  }


  saveExhibitors();

  resetForm();

  populateTypeFilter();

  applyFilters();

}


/* =========================================================
   EDIT
   ========================================================= */

function editExhibitor(id){

  const exhibitor =
    allExhibitors.find(
      row =>
        row.id === id
    );


  if(!exhibitor){
    return;
  }


  editingExhibitorId =
    id;


  $('exhibitorName')
    .value =
      exhibitor.name || '';


  $('exhibitorCompany')
    .value =
      exhibitor.company || '';


  $('exhibitorDesignation')
    .value =
      exhibitor.designation || '';


  const standardTypes = [
    'Exhibitor',
    'Sponsor',
    'Industry Partner',
    'Booth Crew'
  ];


  if(
    standardTypes.includes(
      exhibitor.type
    )
  ){

    $('exhibitorType')
      .value =
        exhibitor.type;


    $('otherTypeWrapper')
      .classList
      .remove('show');


    $('exhibitorOtherType')
      .value = '';

  }else{

    $('exhibitorType')
      .value =
        'Others';


    $('otherTypeWrapper')
      .classList
      .add('show');


    $('exhibitorOtherType')
      .value =
        exhibitor.type || '';

  }


  $('editingName')
    .textContent =
      exhibitor.name;


  $('editingNotice')
    .hidden = false;


  $('addExhibitorBtn')
    .textContent =
      'Save Changes';


  window.scrollTo({
    top:0,
    behavior:'smooth'
  });

}


/* =========================================================
   DELETE
   ========================================================= */

function deleteExhibitor(id){

  const exhibitor =
    allExhibitors.find(
      row =>
        row.id === id
    );


  if(!exhibitor){
    return;
  }


  const confirmed =
    confirm(
      `Delete ${exhibitor.name}?`
    );


  if(!confirmed){
    return;
  }


  allExhibitors =
    allExhibitors.filter(
      row =>
        row.id !== id
    );


  selectedExhibitors
    .delete(id);


  if(
    editingExhibitorId === id
  ){

    resetForm();

  }


  saveExhibitors();

  populateTypeFilter();

  applyFilters();

  renderCardWorkspace();

}


/* =========================================================
   DELETE ALL
   ========================================================= */

function deleteAllExhibitors(){

  if(
    !allExhibitors.length
  ){

    alert(
      'There are no exhibitors to delete.'
    );

    return;

  }


  const confirmed =
    confirm(
      'Delete ALL exhibitors from this browser?\n\nThis cannot be undone.'
    );


  if(!confirmed){
    return;
  }


  allExhibitors = [];

  selectedExhibitors
    .clear();


  saveExhibitors();

  resetForm();

  populateTypeFilter();

  applyFilters();

  renderCardWorkspace();

}


/* =========================================================
   FILTER
   ========================================================= */

function populateTypeFilter(){

  const current =
    $('typeFilter').value;


  const types =
    [
      ...new Set(
        allExhibitors
          .map(
            exhibitor =>
              exhibitor.type || ''
          )
          .filter(Boolean)
      )
    ]
      .sort();


  $('typeFilter')
    .innerHTML =
      `
        <option value="">
          All Types
        </option>
      ` +
      types
        .map(
          type =>
            `
              <option value="${escapeHtml(type)}">
                ${escapeHtml(type)}
              </option>
            `
        )
        .join('');


  if(
    types.includes(current)
  ){

    $('typeFilter')
      .value =
        current;

  }

}


function applyFilters(){

  const search =
    $('searchBox')
      .value
      .trim()
      .toLowerCase();


  const selectedType =
    $('typeFilter')
      .value;


  filteredExhibitors =
    allExhibitors.filter(
      exhibitor => {

        const searchable =
          [
            exhibitor.name,
            exhibitor.company,
            exhibitor.designation,
            exhibitor.type
          ]
            .join(' ')
            .toLowerCase();


        const matchSearch =
          !search ||
          searchable.includes(
            search
          );


        const matchType =
          !selectedType ||
          exhibitor.type ===
            selectedType;


        return (
          matchSearch &&
          matchType
        );

      }
    );


  renderExhibitorList();

  updateSummary();

}


/* =========================================================
   EXHIBITOR LIST
   ========================================================= */

function renderExhibitorList(){

  if(
    !filteredExhibitors.length
  ){

    $('exhibitorList')
      .innerHTML =
        `
          <div class="empty-state">
            No exhibitors found.
          </div>
        `;

    return;

  }


  $('exhibitorList')
    .innerHTML =
      filteredExhibitors
        .map(
          exhibitor => {

            const checked =
              selectedExhibitors
                .has(
                  exhibitor.id
                );


            return `
              <div
                class="participant-item ${
                  checked
                    ? 'selected-item'
                    : ''
                }">

                <input
                  type="checkbox"
                  class="exhibitor-checkbox"
                  data-id="${escapeHtml(exhibitor.id)}"
                  ${checked ? 'checked' : ''}>

                <div class="participant-main">

                  <div class="participant-name">
                    ${escapeHtml(exhibitor.name)}
                  </div>

                  <div class="participant-code">
                    ${escapeHtml(exhibitor.company)}
                  </div>

                  ${
                    exhibitor.designation
                      ? `
                          <div class="participant-detail">
                            ${escapeHtml(exhibitor.designation)}
                          </div>
                        `
                      : ''
                  }

                  <div class="exhibitor-type-badge">
                    ${escapeHtml(exhibitor.type)}
                  </div>

                  <div class="exhibitor-actions">

                    <button
                      type="button"
                      class="btn btn-secondary btn-small"
                      onclick="editExhibitor('${escapeHtml(exhibitor.id)}')">
                      Edit
                    </button>

                    <button
                      type="button"
                      class="btn btn-danger btn-small"
                      onclick="deleteExhibitor('${escapeHtml(exhibitor.id)}')">
                      Delete
                    </button>

                  </div>

                </div>

              </div>
            `;

          }
        )
        .join('');

}


/* =========================================================
   SELECTION
   ========================================================= */

$('exhibitorList')
  .addEventListener(
    'change',
    event => {

      const checkbox =
        event.target.closest(
          '.exhibitor-checkbox'
        );


      if(!checkbox){
        return;
      }


      const id =
        checkbox.dataset.id;


      const exhibitor =
        allExhibitors.find(
          row =>
            row.id === id
        );


      if(!exhibitor){
        return;
      }


      if(
        checkbox.checked
      ){

        selectedExhibitors
          .set(
            id,
            exhibitor
          );

      }else{

        selectedExhibitors
          .delete(id);

      }


      renderExhibitorList();

      renderCardWorkspace();

      updateSummary();

    }
  );


/* =========================================================
   CARD
   ========================================================= */

function createIdCard(
  exhibitor
){

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


      <div class="exhibitor-card-main">

        <div class="exhibitor-watermark">
          MTERMS
        </div>


        <div class="exhibitor-card-type">
          ${escapeHtml(
            exhibitor.type
          )}
        </div>


        <div class="id-card-name">
          ${escapeHtml(
            exhibitor.name
          )}
        </div>


        <div class="id-card-affiliation">
          ${escapeHtml(
            exhibitor.company
          )}
        </div>


        ${
          exhibitor.designation
            ? `
                <div class="id-card-designation">
                  ${escapeHtml(
                    exhibitor.designation
                  )}
                </div>
              `
            : ''
        }

      </div>


      <div class="id-card-footer">
        MTERMS 2026
      </div>

    </div>
  `;

}


/* =========================================================
   CARD WORKSPACE
   ========================================================= */

function renderCardWorkspace(){

  const selected =
    [
      ...selectedExhibitors
        .values()
    ];


  if(
    !selected.length
  ){

    $('cardWorkspace')
      .innerHTML =
        `
          <div class="empty-state">
            Select exhibitors above
            to prepare ID cards.
          </div>
        `;


    $('a4Pages')
      .innerHTML =
        '';


    updateSummary();

    return;

  }


  $('cardWorkspace')
    .innerHTML =
      selected
        .map(
          exhibitor =>
            `
              <div
                class="badge-editor">

                <div class="badge-editor-title">
                  ${escapeHtml(
                    exhibitor.name
                  )}
                </div>

                ${createIdCard(
                  exhibitor
                )}

              </div>
            `
        )
        .join('');


  renderA4Pages();

}


/* =========================================================
   A4 PRINT LAYOUT
   ========================================================= */

function renderA4Pages(){

  const selected =
    [
      ...selectedExhibitors
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


  $('a4Pages')
    .innerHTML =
      pages
        .map(
          (pageRows,pageIndex) =>
            `
              <div
                class="a4-page"
                data-page="${pageIndex + 1}">

                ${
                  pageRows
                    .map(
                      exhibitor =>
                        `
                          <div class="print-card-slot">

                            ${createIdCard(
                              exhibitor
                            )}

                          </div>
                        `
                    )
                    .join('')
                }

              </div>
            `
        )
        .join('');


  updateSummary();

}


/* =========================================================
   SUMMARY
   ========================================================= */

function updateSummary(){

  $('totalLoaded')
    .textContent =
      allExhibitors.length;


  $('totalShowing')
    .textContent =
      filteredExhibitors.length;


  $('totalSelected')
    .textContent =
      selectedExhibitors.size;


  $('totalPages')
    .textContent =
      Math.ceil(
        selectedExhibitors.size /
        9
      );

}


/* =========================================================
   BUTTONS
   ========================================================= */

$('addExhibitorBtn')
  .addEventListener(
    'click',
    addOrUpdateExhibitor
  );


$('cancelEditBtn')
  .addEventListener(
    'click',
    resetForm
  );


$('exhibitorType')
  .addEventListener(
    'change',
    handleTypeSelection
  );


$('searchBox')
  .addEventListener(
    'input',
    applyFilters
  );


$('typeFilter')
  .addEventListener(
    'change',
    applyFilters
  );


$('selectVisibleBtn')
  .addEventListener(
    'click',
    () => {

      filteredExhibitors
        .forEach(
          exhibitor => {

            selectedExhibitors
              .set(
                exhibitor.id,
                exhibitor
              );

          }
        );


      renderExhibitorList();

      renderCardWorkspace();

      updateSummary();

    }
  );


$('clearSelectionBtn')
  .addEventListener(
    'click',
    () => {

      selectedExhibitors
        .clear();


      renderExhibitorList();

      renderCardWorkspace();

      updateSummary();

    }
  );


$('clearAllBtn')
  .addEventListener(
    'click',
    deleteAllExhibitors
  );


$('previewPrintBtn')
  .addEventListener(
    'click',
    () => {

      if(
        !selectedExhibitors.size
      ){

        alert(
          'Please select at least one exhibitor.'
        );

        return;

      }


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
        !selectedExhibitors.size
      ){

        alert(
          'Please select at least one exhibitor.'
        );

        return;

      }


      window.print();

    }
  );


/* =========================================================
   ENTER KEY SUPPORT
   ========================================================= */

[
  'exhibitorName',
  'exhibitorCompany',
  'exhibitorDesignation',
  'exhibitorOtherType'
]
  .forEach(
    id => {

      $(id)
        .addEventListener(
          'keydown',
          event => {

            if(
              event.key ===
              'Enter'
            ){

              event.preventDefault();

              addOrUpdateExhibitor();

            }

          }
        );

    }
  );


/* =========================================================
   INITIAL LOAD
   ========================================================= */

populateTypeFilter();

applyFilters();

renderCardWorkspace();

updateSummary();
