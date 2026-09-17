/**
 * OddajTo / PayBack - Logika aplikacji
 * Obsługa aktywnego profilu, trybu Dark/Light, zaawansowanej walidacji, customowych potwierdzeń i toastów
 */

document.addEventListener('DOMContentLoaded', () => {
  let debtsData = [];
  let statsData = null;
  let currentFilter = 'UNSETTLED';
  let selectedFilterPerson = 'ALL';
  let searchQuery = '';
  let currentLang = localStorage.getItem('oddaj_lang') || 'pl';
  let activeProfile = localStorage.getItem('oddaj_active_profile') || 'Ja';
  let currentTheme = localStorage.getItem('oddaj_theme') || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

  let splitSelectedPeople = [];
  let knownPeopleList = [];
  let currentPartialDebt = null;
  let confirmCallback = null;

  // Słownik tłumaczeń
  const i18n = {
    pl: {
      appTitle: 'OddajTo',
      appSubtitle: 'Proste rozliczenia i rejestr długów',
      btnAddMain: 'Nowe rozliczenie',
      lblDashboardBadge: 'PULPIT',
      lblLiveStatus: 'Na bieżąco z bazą',
      lblMyProfile: 'Kim jesteś:',
      lblStatTotal: 'Wszystkie do spłaty',
      lblStatReceive: (name) => name === '__ALL__' ? 'Należności łącznie' : `Do odebrania (${name})`,
      lblStatPay: (name) => name === '__ALL__' ? 'Zobowiązania łącznie' : `Do oddania (${name})`,
      lblStatSettled: 'Rozliczone łącznie',
      statReceiveDesc: (name) => name === '__ALL__' ? 'Łączna suma należności' : `Inni wiszą dla: ${name}`,
      statPayDesc: (name) => name === '__ALL__' ? 'Łączna suma zobowiązań' : `${name} wisi innym`,
      statActiveCount: (c) => `${c} aktywnych pozycji`,
      statSettledCount: (c) => `${c} rozliczonych`,
      lblPeopleTitle: 'Bilanse znajomych:',
      lblPeopleHint: 'Przewijaj w poziomie • Kliknij, aby filtrować',
      allPeopleTag: 'Wszyscy',
      allPeopleProfile: '👥 Cała grupa (Wszyscy)',
      tabUnsettled: 'Do oddania',
      tabSettled: 'Rozliczone',
      tabAll: 'Wszystkie',
      optAllPeople: 'Wszystkie osoby',
      searchPlaceholder: 'Szukaj osoby lub za co...',
      lblListTitle: 'Lista rozliczeń',
      lblLoading: 'Ładowanie rozliczeń...',
      emptyTitle: 'Brak rozliczeń',
      emptySubtitle: 'Brak pozycji dla wybranych filtrów. Kliknij "+ Nowe rozliczenie", aby dodać wpis.',
      currency: 'zł',
      statusActive: 'Do spłaty',
      statusPartial: 'Częściowo spłacone',
      statusSettled: 'Rozliczone',
      btnSettle: 'Oddaj całość',
      btnPartial: 'Spłać część',
      btnHistory: 'Historia',
      btnDelete: 'Usuń',
      modalAddTitle: 'Nowe Rozliczenie',
      tabModeSingle: 'Pojedynczy dług',
      tabModeSplit: 'Podziel rachunek (Zrzutka)',
      lblFormDebtor: 'Kto wisi (Dłużnik):',
      lblFormCreditor: 'Komu wisi (Wierzyciel):',
      lblFormAmount: 'Kwota:',
      lblFormCurrency: 'Waluta:',
      lblFormReason: 'Za co (opcjonalnie):',
      placeholderDebtor: 'np. Marek lub Ja',
      placeholderCreditor: 'np. Ania lub Ja',
      placeholderAmount: 'np. 50.00',
      placeholderReason: 'np. Pizza, Paliwo, Bilet, Zakupy...',
      btnCancel: 'Anuluj',
      btnSubmitAdd: 'Zapisz rozliczenie',
      lblSplitPayer: 'Kto wyłożył całość (Płacący):',
      lblSplitTotal: 'Całkowity rachunek:',
      lblSplitTitle: 'Za co (Tytuł):',
      lblSplitPeople: 'Osoby biorące udział w podziale:',
      placeholderAddPerson: 'Wpisz imię i wciśnij Enter lub Dodaj',
      lblAddPersonBtn: 'Dodaj',
      lblQuickSuggest: 'Szybki wybór ze znajomych:',
      lblSelectedPeopleTitle: 'Wybrane osoby:',
      btnClearAllPeople: 'Wyczyść wszystkich',
      selectedEmptyHint: 'Dodaj osoby powyżej lub kliknij ze znajomych.',
      lblSplitIncludePayer: 'Wlicz płacącego w podział (rachunek dzieli się też na mnie)',
      btnSubmitSplit: 'Podziel i zapisz',
      splitPreviewEmpty: 'Wpisz kwotę i wybierz osoby, aby zobaczyć podział...',
      splitPreviewResult: (perPerson, count, payer) => `Każda z ${count} osób oddaje dla <strong>${escapeHtml(payer)}</strong> po: <strong>${perPerson}</strong>`,
      modalPayTitle: 'Częściowa Spłata',
      lblPartialAmount: 'Kwota wpłaty:',
      payPartialInfoText: (debtor, creditor, title, remaining) => `<strong>${escapeHtml(debtor)}</strong> ➔ <strong>${escapeHtml(creditor)}</strong> (${escapeHtml(title)})<br>Pozostało do oddania: <strong>${remaining}</strong>`,
      btnSubmitPartial: 'Zatwierdź wpłatę',
      modalHistoryTitle: 'Historia Spłat',
      lblHistorySubtitle: 'Zarejestrowane wpłaty:',
      historyModalInfoText: (debtor, creditor, title, initial, remaining) => `<strong>${escapeHtml(debtor)}</strong> ➔ <strong>${escapeHtml(creditor)}</strong>: <strong>${escapeHtml(title)}</strong><br>Początkowa kwota: ${initial} | Pozostało: <strong>${remaining}</strong>`,
      historyEmpty: 'Brak wpłat w historii.',
      btnUndoPayment: '✕ Cofnij',
      btnCloseHistory: 'Zamknij',
      confirmTitle: 'Potwierdzenie operacji',
      confirmSettle: (debtor, creditor, amount) => `Czy potwierdzasz rozliczenie całej kwoty (${amount}) między ${debtor} a ${creditor}?`,
      confirmDelete: 'Czy na pewno chcesz usunąć to rozliczenie z bazy danych?',
      confirmUndoPayment: 'Czy na pewno chcesz cofnąć tę wpłatę i przywrócić kwotę do długu?',
      errDebtorReq: 'Podaj imię lub pseudonim dłużnika.',
      errCreditorReq: 'Podaj imię lub pseudonim wierzyciela.',
      errSamePerson: 'Dłużnik i wierzyciel nie mogą być tą samą osobą.',
      errAmountPos: 'Wpisz poprawną kwotę większą od zera (np. 25.50).',
      errPayerReq: 'Podaj osobę płacącą.',
      errSplitTitleReq: 'Podaj tytuł wydatku (np. Pizza).',
      errSplitPeopleReq: 'Dodaj co najmniej jedną inną osobę do podziału.',
      errPayAmountMax: (max) => `Kwota wpłaty nie może być większa niż ${max}.`,
      toastDebtAdded: 'Rozliczenie zostało pomyślnie zapisane!',
      toastSplitAdded: 'Rachunek został pomyślnie podzielony!',
      toastSettled: 'Rozliczono w całości!',
      toastPartialPaid: 'Zarejestrowano częściową wpłatę!',
      toastPaymentUndone: 'Cofnięto wpłatę z historii.',
      toastDeleted: 'Rozliczenie zostało usunięte.'
    },
    en: {
      appTitle: 'PayBack',
      appSubtitle: 'Simple debt & expense settlement tracker',
      btnAddMain: 'New Settlement',
      lblDashboardBadge: 'DASHBOARD',
      lblLiveStatus: 'Synced with database',
      lblMyProfile: 'Who are you:',
      lblStatTotal: 'Total Active Debts',
      lblStatReceive: (name) => name === '__ALL__' ? 'Total Receivables' : `Receivable by (${name})`,
      lblStatPay: (name) => name === '__ALL__' ? 'Total Payables' : `Payable by (${name})`,
      lblStatSettled: 'Total Settled',
      statReceiveDesc: (name) => name === '__ALL__' ? 'Total group receivables' : `Others owe to: ${name}`,
      statPayDesc: (name) => name === '__ALL__' ? 'Total group payables' : `${name} owes others`,
      statActiveCount: (c) => `${c} active items`,
      statSettledCount: (c) => `${c} settled`,
      lblPeopleTitle: 'People Balances:',
      lblPeopleHint: 'Scroll horizontally • Click to filter',
      allPeopleTag: 'All',
      allPeopleProfile: '👥 Whole group (All)',
      tabUnsettled: 'Active',
      tabSettled: 'Settled',
      tabAll: 'All',
      optAllPeople: 'All people',
      searchPlaceholder: 'Search person or reason...',
      lblListTitle: 'Settlements List',
      lblLoading: 'Loading settlements...',
      emptyTitle: 'No settlements found',
      emptySubtitle: 'No items match current filters. Click "+ New Settlement" to create one.',
      currency: 'PLN',
      statusActive: 'Active',
      statusPartial: 'Partially Paid',
      statusSettled: 'Settled',
      btnSettle: 'Settle all',
      btnPartial: 'Pay part',
      btnHistory: 'History',
      btnDelete: 'Delete',
      modalAddTitle: 'New Settlement',
      tabModeSingle: 'Single debt',
      tabModeSplit: 'Split bill among friends',
      lblFormDebtor: 'Who owes (Debtor):',
      lblFormCreditor: 'To whom (Creditor):',
      lblFormAmount: 'Amount:',
      lblFormCurrency: 'Currency:',
      lblFormReason: 'For what (optional):',
      placeholderDebtor: 'e.g. Mark or Me',
      placeholderCreditor: 'e.g. Ann or Me',
      placeholderAmount: 'e.g. 50.00',
      placeholderReason: 'e.g. Pizza, Fuel, Ticket, Grocery...',
      btnCancel: 'Cancel',
      btnSubmitAdd: 'Save Settlement',
      lblSplitPayer: 'Who paid total (Creditor):',
      lblSplitTotal: 'Total bill:',
      lblSplitTitle: 'For what (Title):',
      lblSplitPeople: 'People participating in split:',
      placeholderAddPerson: 'Type name and hit Enter or Add',
      lblAddPersonBtn: 'Add',
      lblQuickSuggest: 'Quick pick from contacts:',
      lblSelectedPeopleTitle: 'Selected people:',
      btnClearAllPeople: 'Clear all',
      selectedEmptyHint: 'Add people above or pick from contacts.',
      lblSplitIncludePayer: 'Include payer in split (bill is divided among me as well)',
      btnSubmitSplit: 'Split and Save',
      splitPreviewEmpty: 'Enter total amount and pick people to see live calculation...',
      splitPreviewResult: (perPerson, count, payer) => `Each of ${count} people will owe <strong>${escapeHtml(payer)}</strong>: <strong>${perPerson}</strong>`,
      modalPayTitle: 'Partial Payment',
      lblPartialAmount: 'Payment amount:',
      payPartialInfoText: (debtor, creditor, title, remaining) => `<strong>${escapeHtml(debtor)}</strong> ➔ <strong>${escapeHtml(creditor)}</strong> (${escapeHtml(title)})<br>Remaining balance: <strong>${remaining}</strong>`,
      btnSubmitPartial: 'Confirm Payment',
      modalHistoryTitle: 'Payment History',
      lblHistorySubtitle: 'Recorded payments:',
      historyModalInfoText: (debtor, creditor, title, initial, remaining) => `<strong>${escapeHtml(debtor)}</strong> ➔ <strong>${escapeHtml(creditor)}</strong>: <strong>${escapeHtml(title)}</strong><br>Initial amount: ${initial} | Remaining: <strong>${remaining}</strong>`,
      historyEmpty: 'No payment history recorded yet.',
      btnUndoPayment: '✕ Undo',
      btnCloseHistory: 'Close',
      confirmTitle: 'Confirmation',
      confirmSettle: (debtor, creditor, amount) => `Did ${debtor} settle the full amount (${amount}) to ${creditor}?`,
      confirmDelete: 'Are you sure you want to delete this settlement?',
      confirmUndoPayment: 'Are you sure you want to undo this payment and restore balance?',
      errDebtorReq: 'Please enter debtor name.',
      errCreditorReq: 'Please enter creditor name.',
      errSamePerson: 'Debtor and Creditor cannot be the same person.',
      errAmountPos: 'Please enter a valid amount greater than 0 (e.g. 25.50).',
      errPayerReq: 'Please enter payer name.',
      errSplitTitleReq: 'Please enter a title (e.g. Pizza).',
      errSplitPeopleReq: 'Please add at least 1 other person to split with.',
      errPayAmountMax: (max) => `Payment cannot exceed ${max}.`,
      toastDebtAdded: 'Settlement saved successfully!',
      toastSplitAdded: 'Bill split saved successfully!',
      toastSettled: 'Settled in full!',
      toastPartialPaid: 'Partial payment recorded!',
      toastPaymentUndone: 'Payment undone.',
      toastDeleted: 'Settlement deleted.'
    }
  };

  // Elementy DOM
  const appTitleEl = document.getElementById('appTitle');
  const appSubtitleEl = document.getElementById('appSubtitle');
  const openAddModalBtn = document.getElementById('openAddModalBtn');
  const btnAddMainText = document.getElementById('btnAddMainText');
  const langButtons = document.querySelectorAll('.lang-btn');
  const themeToggleBtn = document.getElementById('themeToggleBtn');

  // Tożsamość profilu
  const lblMyProfile = document.getElementById('lblMyProfile');
  const userProfileSelect = document.getElementById('userProfileSelect');

  // Dashboard elementy
  const lblDashboardBadge = document.getElementById('lblDashboardBadge');
  const lblLiveStatus = document.getElementById('lblLiveStatus');
  const lblStatTotal = document.getElementById('lblStatTotal');
  const statTotalActive = document.getElementById('statTotalActive');
  const statActiveCount = document.getElementById('statActiveCount');

  const lblStatReceive = document.getElementById('lblStatReceive');
  const statMyReceive = document.getElementById('statMyReceive');
  const statReceiveDesc = document.getElementById('statReceiveDesc');

  const lblStatPay = document.getElementById('lblStatPay');
  const statMyPay = document.getElementById('statMyPay');
  const statPayDesc = document.getElementById('statPayDesc');

  const lblStatSettled = document.getElementById('lblStatSettled');
  const statSettledTotal = document.getElementById('statSettledTotal');
  const statSettledCount = document.getElementById('statSettledCount');

  const lblPeopleTitle = document.getElementById('lblPeopleTitle');
  const lblPeopleHint = document.getElementById('lblPeopleHint');
  const peopleListEl = document.getElementById('peopleList');
  const peopleScrollContainer = document.getElementById('peopleScrollContainer');
  const btnScrollPeopleLeft = document.getElementById('btnScrollPeopleLeft');
  const btnScrollPeopleRight = document.getElementById('btnScrollPeopleRight');

  // Toolbar & Lista
  const tabUnsettledText = document.getElementById('tabUnsettledText');
  const tabSettledText = document.getElementById('tabSettledText');
  const tabAllText = document.getElementById('tabAllText');
  const filterTabs = document.querySelectorAll('.tab-btn');
  const personFilter = document.getElementById('personFilter');
  const optAllPeople = document.getElementById('optAllPeople');
  const filterSearch = document.getElementById('filterSearch');
  const clearSearchBtn = document.getElementById('clearSearchBtn');

  const lblListTitle = document.getElementById('lblListTitle');
  const debtsCountEl = document.getElementById('debtsCount');
  const debtsListEl = document.getElementById('debtsList');
  const peopleDatalist = document.getElementById('peopleDatalist');
  const activeFilterTag = document.getElementById('activeFilterTag');
  const activeFilterName = document.getElementById('activeFilterName');
  const clearPersonFilterBtn = document.getElementById('clearPersonFilterBtn');

  // Modale
  const addModal = document.getElementById('addModal');
  const modalAddTitle = document.getElementById('modalAddTitle');
  const tabModeSingle = document.getElementById('tabModeSingle');
  const tabModeSingleText = document.getElementById('tabModeSingleText');
  const tabModeSplit = document.getElementById('tabModeSplit');
  const tabModeSplitText = document.getElementById('tabModeSplitText');
  const addDebtForm = document.getElementById('addDebtForm');
  const splitBillForm = document.getElementById('splitBillForm');

  const lblFormDebtor = document.getElementById('lblFormDebtor');
  const debtorInput = document.getElementById('debtorInput');
  const debtorError = document.getElementById('debtorError');
  const lblFormCreditor = document.getElementById('lblFormCreditor');
  const creditorInput = document.getElementById('creditorInput');
  const creditorError = document.getElementById('creditorError');
  const lblFormAmount = document.getElementById('lblFormAmount');
  const debtAmountInput = document.getElementById('debtAmount');
  const amountError = document.getElementById('amountError');
  const lblFormCurrency = document.getElementById('lblFormCurrency');
  const debtCurrency = document.getElementById('debtCurrency');
  const lblFormReason = document.getElementById('lblFormReason');
  const debtTitleInput = document.getElementById('debtTitle');
  const btnCancelAdd = document.getElementById('btnCancelAdd');
  const btnSubmitAddText = document.getElementById('btnSubmitAddText');

  // Split bill controls
  const lblSplitPayer = document.getElementById('lblSplitPayer');
  const splitPayerInput = document.getElementById('splitPayerInput');
  const splitPayerError = document.getElementById('splitPayerError');
  const lblSplitTotal = document.getElementById('lblSplitTotal');
  const splitTotalInput = document.getElementById('splitTotalInput');
  const splitTotalError = document.getElementById('splitTotalError');
  const lblSplitCurrency = document.getElementById('lblSplitCurrency');
  const splitCurrency = document.getElementById('splitCurrency');
  const lblSplitTitle = document.getElementById('lblSplitTitle');
  const splitTitleInput = document.getElementById('splitTitleInput');
  const splitTitleError = document.getElementById('splitTitleError');
  const lblSplitPeople = document.getElementById('lblSplitPeople');
  const splitAddPersonInput = document.getElementById('splitAddPersonInput');
  const splitAddPersonBtn = document.getElementById('splitAddPersonBtn');
  const splitPeopleError = document.getElementById('splitPeopleError');
  const lblAddPersonBtn = document.getElementById('lblAddPersonBtn');
  const lblQuickSuggest = document.getElementById('lblQuickSuggest');
  const splitQuickSuggestions = document.getElementById('splitQuickSuggestions');
  const lblSelectedPeopleTitle = document.getElementById('lblSelectedPeopleTitle');
  const splitPeopleCount = document.getElementById('splitPeopleCount');
  const splitClearAllPeopleBtn = document.getElementById('splitClearAllPeopleBtn');
  const splitSelectedPeopleList = document.getElementById('splitSelectedPeopleList');
  const splitIncludePayer = document.getElementById('splitIncludePayer');
  const lblSplitIncludePayer = document.getElementById('lblSplitIncludePayer');
  const splitPreviewText = document.getElementById('splitPreviewText');
  const btnCancelSplit = document.getElementById('btnCancelSplit');
  const btnSubmitSplitText = document.getElementById('btnSubmitSplitText');

  // Modal Spłaty
  const payPartialModal = document.getElementById('payPartialModal');
  const modalPayTitle = document.getElementById('modalPayTitle');
  const payPartialInfo = document.getElementById('payPartialInfo');
  const payPartialDebtId = document.getElementById('payPartialDebtId');
  const lblPartialAmount = document.getElementById('lblPartialAmount');
  const payPartialAmountInput = document.getElementById('payPartialAmountInput');
  const payPartialError = document.getElementById('payPartialError');
  const btnCancelPartial = document.getElementById('btnCancelPartial');
  const btnSubmitPartialText = document.getElementById('btnSubmitPartialText');
  const payPartialForm = document.getElementById('payPartialForm');

  // Modal Historii
  const historyModal = document.getElementById('historyModal');
  const modalHistoryTitle = document.getElementById('modalHistoryTitle');
  const lblHistorySubtitle = document.getElementById('lblHistorySubtitle');
  const historyModalInfo = document.getElementById('historyModalInfo');
  const historyPaymentsList = document.getElementById('historyPaymentsList');
  const btnCloseHistory = document.getElementById('btnCloseHistory');

  // Custom Confirm Modal
  const confirmModal = document.getElementById('confirmModal');
  const confirmModalTitle = document.getElementById('confirmModalTitle');
  const confirmModalMessage = document.getElementById('confirmModalMessage');
  const confirmModalActionBtn = document.getElementById('confirmModalActionBtn');
  const confirmModalCancelBtn = document.getElementById('confirmModalCancelBtn');

  // Toast Container
  const toastContainer = document.getElementById('toastContainer');

  init();

  function init() {
    setupTheme();
    setupLanguage();
    setupProfileSelect();
    setupModals();
    setupFilters();
    setupPeopleScroll();
    setupInteractivePersonPicker();
    setupQuickPayChips();
    setupSplitPreview();
    setupKeyboardShortcuts();
    loadData();
  }

  function t() {
    return i18n[currentLang] || i18n.pl;
  }

  // =========================================================================
  // MOTYW (DARK / LIGHT MODE)
  // =========================================================================
  function setupTheme() {
    document.documentElement.setAttribute('data-theme', currentTheme);
    if (themeToggleBtn) {
      themeToggleBtn.addEventListener('click', () => {
        currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', currentTheme);
        localStorage.setItem('oddaj_theme', currentTheme);
      });
    }
  }

  // =========================================================================
  // SYSTEM TOASTÓW POWIADOMIEŃ
  // =========================================================================
  function showToast(message, type = 'success') {
    if (!toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast-item toast-${type}`;

    let iconSvg = '';
    if (type === 'success') {
      iconSvg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>';
    } else if (type === 'error') {
      iconSvg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
    } else {
      iconSvg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
    }

    toast.innerHTML = `
      <div class="toast-icon">${iconSvg}</div>
      <div class="toast-content">
        <div class="toast-message">${escapeHtml(message)}</div>
      </div>
      <div class="toast-progress"></div>
    `;

    toastContainer.appendChild(toast);

    // Animacja wejścia
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    const timeout = setTimeout(() => {
      dismissToast(toast);
    }, 3200);

    toast.addEventListener('click', () => {
      clearTimeout(timeout);
      dismissToast(toast);
    });
  }

  function dismissToast(toast) {
    toast.classList.remove('show');
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 280);
  }

  // =========================================================================
  // CUSTOM CONFIRM MODAL
  // =========================================================================
  function showConfirmDialog({ title, message, confirmText, isDanger = false, onConfirm }) {
    const cur = t();
    confirmModalTitle.textContent = title || cur.confirmTitle;
    confirmModalMessage.textContent = message;
    confirmModalActionBtn.textContent = confirmText || cur.btnSubmitAdd;

    if (isDanger) {
      confirmModalActionBtn.className = 'btn btn-primary';
      confirmModalActionBtn.style.background = 'var(--danger)';
    } else {
      confirmModalActionBtn.className = 'btn btn-primary';
      confirmModalActionBtn.style.background = '';
    }

    confirmCallback = onConfirm;
    confirmModal.classList.add('active');
  }

  confirmModalActionBtn.addEventListener('click', () => {
    if (confirmCallback) {
      const cb = confirmCallback;
      confirmCallback = null;
      cb();
    }
    confirmModal.classList.remove('active');
  });

  // =========================================================================
  // JĘZYKI (I18N)
  // =========================================================================
  function setupLanguage() {
    langButtons.forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-lang') === currentLang);
      btn.addEventListener('click', () => {
        currentLang = btn.getAttribute('data-lang');
        localStorage.setItem('oddaj_lang', currentLang);
        langButtons.forEach(b => b.classList.toggle('active', b.getAttribute('data-lang') === currentLang));
        applyLanguage();
        renderDashboard();
        renderList();
      });
    });

    applyLanguage();
  }

  function applyLanguage() {
    const cur = t();
    document.documentElement.lang = currentLang;
    appTitleEl.textContent = cur.appTitle;
    appSubtitleEl.textContent = cur.appSubtitle;
    btnAddMainText.textContent = cur.btnAddMain;

    lblDashboardBadge.textContent = cur.lblDashboardBadge;
    lblLiveStatus.textContent = cur.lblLiveStatus;
    lblMyProfile.textContent = cur.lblMyProfile;
    lblStatTotal.textContent = cur.lblStatTotal;
    lblStatSettled.textContent = cur.lblStatSettled;

    lblPeopleTitle.textContent = cur.lblPeopleTitle;
    lblPeopleHint.textContent = cur.lblPeopleHint;

    tabUnsettledText.textContent = cur.tabUnsettled;
    tabSettledText.textContent = cur.tabSettled;
    tabAllText.textContent = cur.tabAll;
    optAllPeople.textContent = cur.optAllPeople;
    filterSearch.placeholder = cur.searchPlaceholder;
    lblListTitle.textContent = cur.lblListTitle;

    modalAddTitle.textContent = cur.modalAddTitle;
    tabModeSingleText.textContent = cur.tabModeSingle;
    tabModeSplitText.textContent = cur.tabModeSplit;

    // Formularz pojedynczy
    lblFormDebtor.textContent = cur.lblFormDebtor;
    debtorInput.placeholder = cur.placeholderDebtor;
    lblFormCreditor.textContent = cur.lblFormCreditor;
    creditorInput.placeholder = cur.placeholderCreditor;
    lblFormAmount.textContent = cur.lblFormAmount;
    debtAmountInput.placeholder = cur.placeholderAmount;
    lblFormCurrency.textContent = cur.lblFormCurrency;
    lblFormReason.textContent = cur.lblFormReason;
    debtTitleInput.placeholder = cur.placeholderReason;
    btnCancelAdd.textContent = cur.btnCancel;
    btnSubmitAddText.textContent = cur.btnSubmitAdd;

    // Formularz zrzutki
    lblSplitPayer.textContent = cur.lblSplitPayer;
    splitPayerInput.placeholder = cur.placeholderCreditor;
    lblSplitTotal.textContent = cur.lblSplitTotal;
    splitTotalInput.placeholder = cur.placeholderAmount;
    lblSplitCurrency.textContent = cur.lblFormCurrency;
    lblSplitTitle.textContent = cur.lblSplitTitle;
    splitTitleInput.placeholder = cur.placeholderReason;
    lblSplitPeople.textContent = cur.lblSplitPeople;
    splitAddPersonInput.placeholder = cur.placeholderAddPerson;
    lblAddPersonBtn.textContent = cur.lblAddPersonBtn;
    lblQuickSuggest.textContent = cur.lblQuickSuggest;
    lblSelectedPeopleTitle.textContent = cur.lblSelectedPeopleTitle;
    splitClearAllPeopleBtn.textContent = cur.btnClearAllPeople;
    lblSplitIncludePayer.textContent = cur.lblSplitIncludePayer;
    btnCancelSplit.textContent = cur.btnCancel;
    btnSubmitSplitText.textContent = cur.btnSubmitSplit;

    // Modal spłaty i historii
    modalPayTitle.textContent = cur.modalPayTitle;
    lblPartialAmount.textContent = cur.lblPartialAmount;
    btnCancelPartial.textContent = cur.btnCancel;
    btnSubmitPartialText.textContent = cur.btnSubmitPartial;

    modalHistoryTitle.textContent = cur.modalHistoryTitle;
    lblHistorySubtitle.textContent = cur.lblHistorySubtitle;
    btnCloseHistory.textContent = cur.btnCloseHistory;

    confirmModalCancelBtn.textContent = cur.btnCancel;

    renderSplitSelectedPeople();
    renderSplitQuickSuggestions();
    updateSplitPreview();
  }

  function setupProfileSelect() {
    userProfileSelect.addEventListener('change', (e) => {
      activeProfile = e.target.value;
      localStorage.setItem('oddaj_active_profile', activeProfile);
      renderDashboard();
    });
  }

  function renderProfileSelectOptions(people) {
    const cur = t();
    const uniquePeople = ['Ja', ...people.filter(p => p.toLowerCase() !== 'ja')];
    
    let html = `<option value="__ALL__">${cur.allPeopleProfile}</option>`;
    html += uniquePeople.map(p => `<option value="${escapeHtml(p)}">👤 ${escapeHtml(p)}</option>`).join('');
    
    userProfileSelect.innerHTML = html;

    if (uniquePeople.includes(activeProfile) || activeProfile === '__ALL__') {
      userProfileSelect.value = activeProfile;
    } else {
      userProfileSelect.value = 'Ja';
      activeProfile = 'Ja';
    }
  }

  function setupPeopleScroll() {
    if (btnScrollPeopleLeft && peopleScrollContainer) {
      btnScrollPeopleLeft.addEventListener('click', () => {
        peopleScrollContainer.scrollBy({ left: -220, behavior: 'smooth' });
      });
    }

    if (btnScrollPeopleRight && peopleScrollContainer) {
      btnScrollPeopleRight.addEventListener('click', () => {
        peopleScrollContainer.scrollBy({ left: 220, behavior: 'smooth' });
      });
    }
  }

  function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
      }
    });
  }

  async function loadData() {
    try {
      const [debts, stats, people] = await Promise.all([
        fetch('/api/debts').then(r => r.json()),
        fetch('/api/stats/summary').then(r => r.json()),
        fetch('/api/people').then(r => r.json())
      ]);

      debtsData = Array.isArray(debts) ? debts : [];
      statsData = stats;
      knownPeopleList = Array.isArray(people) ? people : [];

      renderProfileSelectOptions(knownPeopleList);
      renderDashboard();
      renderPersonFilter(knownPeopleList);
      renderList();
      renderPeopleDatalist(knownPeopleList);
      renderSplitQuickSuggestions();
    } catch (err) {
      debtsListEl.innerHTML = `<div class="empty-state"><p style="color: var(--danger); font-weight: 700;">${currentLang === 'en' ? 'Database connection error.' : 'Błąd połączenia z bazą danych.'}</p></div>`;
      console.error(err);
    }
  }

  function formatCurrency(amount, curr = 'PLN') {
    const code = (curr || 'PLN').toUpperCase();
    const symbolMap = {
      'PLN': currentLang === 'en' ? 'PLN' : 'zł',
      'EUR': '€',
      'USD': '$',
      'GBP': '£',
      'CHF': 'CHF',
      'CZK': 'Kč',
      'NOK': 'kr'
    };
    const sym = symbolMap[code] || code;
    const formattedNum = Number(amount || 0).toLocaleString(currentLang === 'pl' ? 'pl-PL' : 'en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    return `${formattedNum} ${sym}`;
  }

  function renderDashboard() {
    const cur = t();
    if (!statsData) return;

    statTotalActive.textContent = formatCurrency(statsData.total_active_amount || 0, 'PLN');
    statActiveCount.textContent = cur.statActiveCount(statsData.active_debts_count || 0);

    statSettledTotal.textContent = formatCurrency(statsData.total_settled_amount || 0, 'PLN');
    statSettledCount.textContent = cur.statSettledCount(statsData.settled_debts_count || 0);

    const displayName = activeProfile === '__ALL__' ? '__ALL__' : activeProfile;

    lblStatReceive.textContent = cur.lblStatReceive(displayName);
    lblStatPay.textContent = cur.lblStatPay(displayName);
    statReceiveDesc.textContent = cur.statReceiveDesc(displayName);
    statPayDesc.textContent = cur.statPayDesc(displayName);

    let myReceive = 0;
    let myPay = 0;

    if (activeProfile === '__ALL__') {
      myReceive = statsData.total_active_amount || 0;
      myPay = statsData.total_active_amount || 0;
    } else {
      const target = activeProfile.toLowerCase();
      const pBalance = (statsData.people_balances || []).find(p => p.name && p.name.toLowerCase() === target);
      if (pBalance) {
        myReceive = pBalance.to_receive || 0;
        myPay = pBalance.to_pay || 0;
      } else {
        debtsData.forEach(d => {
          if (d.status !== 'SETTLED') {
            if (d.creditor_name && d.creditor_name.toLowerCase() === target) {
              myReceive += d.remaining_amount;
            }
            if (d.debtor_name && d.debtor_name.toLowerCase() === target) {
              myPay += d.remaining_amount;
            }
          }
        });
      }
    }

    statMyReceive.textContent = `+${formatCurrency(myReceive, 'PLN')}`;
    statMyPay.textContent = `-${formatCurrency(myPay, 'PLN')}`;

    renderPeopleBalances();
  }

  function renderPeopleBalances() {
    const cur = t();
    if (!statsData || !statsData.people_balances || statsData.people_balances.length === 0) {
      peopleListEl.innerHTML = `<span style="font-size: 13px; color: var(--text-muted); padding: 4px 0;">${currentLang === 'en' ? 'No active debts recorded' : 'Brak aktywnych rozliczeń'}</span>`;
      return;
    }

    const allBtn = `
      <div class="person-pill ${selectedFilterPerson === 'ALL' ? 'is-active' : ''}" onclick="filterByPerson('ALL')">
        <span class="person-avatar">★</span>
        <span>${cur.allPeopleTag}</span>
      </div>
    `;

    const pills = statsData.people_balances.map(p => {
      const net = p.net_balance;
      const isPlus = net > 0;
      const isMinus = net < 0;
      const pillClass = isPlus ? 'is-plus' : (isMinus ? 'is-minus' : '');
      const sign = isPlus ? '+' : '';
      const initial = (p.name || '').charAt(0).toUpperCase();
      const isActive = selectedFilterPerson.toLowerCase() === p.name.toLowerCase();

      return `
        <div class="person-pill ${pillClass} ${isActive ? 'is-active' : ''}" onclick="filterByPerson('${escapeHtml(p.name)}')" title="${p.name}: ${sign}${formatCurrency(net, 'PLN')}">
          <span class="person-avatar">${initial}</span>
          <span>${escapeHtml(p.name)}:</span>
          <strong>${sign}${formatCurrency(net, 'PLN')}</strong>
        </div>
      `;
    }).join('');

    peopleListEl.innerHTML = allBtn + pills;
  }

  function renderPersonFilter(people) {
    const cur = t();
    const currentVal = personFilter.value;
    personFilter.innerHTML = `<option value="ALL">${cur.optAllPeople}</option>` + 
      people.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');
    
    if (people.includes(currentVal)) {
      personFilter.value = currentVal;
    }
  }

  function renderPeopleDatalist(people) {
    peopleDatalist.innerHTML = people.map(p => `<option value="${escapeHtml(p)}">`).join('');
  }

  window.filterByPerson = function(name) {
    selectedFilterPerson = name;
    personFilter.value = name;
    renderPeopleBalances();
    renderList();
  };

  function renderList() {
    const cur = t();
    let filtered = debtsData;

    if (currentFilter === 'UNSETTLED') {
      filtered = filtered.filter(d => d.status !== 'SETTLED');
    } else if (currentFilter === 'SETTLED') {
      filtered = filtered.filter(d => d.status === 'SETTLED');
    }

    if (selectedFilterPerson && selectedFilterPerson !== 'ALL') {
      const p = selectedFilterPerson.toLowerCase();
      filtered = filtered.filter(d => 
        (d.debtor_name && d.debtor_name.toLowerCase() === p) ||
        (d.creditor_name && d.creditor_name.toLowerCase() === p)
      );
      activeFilterTag.style.display = 'inline-flex';
      activeFilterName.textContent = selectedFilterPerson;
    } else {
      activeFilterTag.style.display = 'none';
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(d => 
        (d.debtor_name && d.debtor_name.toLowerCase().includes(q)) ||
        (d.creditor_name && d.creditor_name.toLowerCase().includes(q)) ||
        (d.title && d.title.toLowerCase().includes(q))
      );
    }

    debtsCountEl.textContent = filtered.length;

    if (filtered.length === 0) {
      debtsListEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="8" y1="12" x2="16" y2="12"></line>
            </svg>
          </div>
          <div class="empty-title">${cur.emptyTitle}</div>
          <div class="empty-subtitle">${cur.emptySubtitle}</div>
        </div>
      `;
      return;
    }

    debtsListEl.innerHTML = filtered.map(d => {
      const isSettled = d.status === 'SETTLED';
      const isPartial = d.status === 'PARTIALLY_PAID';
      const paymentsCount = d.payments ? d.payments.length : 0;
      const amountClass = isSettled ? 'is-settled-text' : '';

      // Pasek postępu dla częściowych spłat
      let progressHtml = '';
      if (isPartial && d.amount > 0) {
        const paid = Math.max(0, d.amount - d.remaining_amount);
        const pct = Math.min(100, Math.round((paid / d.amount) * 100));
        progressHtml = `
          <div class="progress-bar-wrap" title="Spłacono ${formatCurrency(paid, d.currency)} (${pct}%)">
            <div class="progress-bar-fill" style="width: ${pct}%"></div>
          </div>
        `;
      }

      // Tagi statusu
      let statusPill = '';
      if (isSettled) {
        statusPill = `<span class="status-pill status-settled"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg> ${cur.statusSettled}</span>`;
      } else if (isPartial) {
        statusPill = `<span class="status-pill status-partial"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><circle cx="12" cy="12" r="8"></circle></svg> ${cur.statusPartial}</span>`;
      } else {
        statusPill = `<span class="status-pill status-active"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><circle cx="12" cy="12" r="8"></circle></svg> ${cur.statusActive}</span>`;
      }

      return `
        <div class="debt-card ${isSettled ? 'is-settled' : ''}">
          <div class="debt-info">
            <div class="debt-actors">
              <span class="actor-badge debtor">
                <span class="actor-dot"></span>
                ${escapeHtml(d.debtor_name)}
              </span>

              <span class="debt-arrow">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
              </span>

              <span class="actor-badge creditor">
                <span class="actor-dot"></span>
                ${escapeHtml(d.creditor_name)}
              </span>

              ${statusPill}
            </div>

            <div class="debt-meta">
              <span class="debt-title">${escapeHtml(d.title || (currentLang === 'en' ? 'Settlement' : 'Rozliczenie'))}</span>
              <span>•</span>
              <span class="debt-date">${d.created_at ? d.created_at.split(' ')[0] : ''}</span>
            </div>

            ${progressHtml}
          </div>

          <div class="debt-actions-wrap">
            <div class="debt-amount-group">
              <div class="debt-main-amount ${amountClass}">
                ${formatCurrency(d.remaining_amount, d.currency)}
              </div>
              ${d.remaining_amount !== d.amount ? `
                <div class="debt-orig-amount">${currentLang === 'en' ? 'of' : 'z'} ${formatCurrency(d.amount, d.currency)}</div>
              ` : ''}
            </div>

            <div class="debt-btn-group">
              ${!isSettled ? `
                <button type="button" class="btn-action-settle" onclick="settleFullDebt(${d.id})" title="${cur.btnSettle}">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  <span>${cur.btnSettle}</span>
                </button>

                <button type="button" class="btn-action-pay" onclick="openPartialPayModal(${d.id})" title="${cur.btnPartial}">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="9"></circle>
                    <path d="M14.8 9A2 2 0 0 0 13 8h-2a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4h-2a2 2 0 0 1-1.8-1"></path>
                    <path d="M12 6v2m0 8v2"></path>
                  </svg>
                  <span>${cur.btnPartial}</span>
                </button>
              ` : ''}

              <button type="button" class="btn-action-history" onclick="openHistoryModal(${d.id})" title="${cur.btnHistory}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 14 14"></polyline>
                </svg>
                <span>${cur.btnHistory}</span>
                ${paymentsCount > 0 ? `<span class="history-badge">${paymentsCount}</span>` : ''}
              </button>

              <button type="button" class="btn-action-delete" onclick="deleteDebt(${d.id})" title="${cur.btnDelete}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // =========================================================================
  // INTERAKTYWNY WYBÓR OSÓB W ZRZUTCE
  // =========================================================================
  function setupInteractivePersonPicker() {
    splitAddPersonBtn.addEventListener('click', () => {
      const val = splitAddPersonInput.value.trim();
      if (val) {
        addPersonToSplit(val);
        splitAddPersonInput.value = '';
        splitAddPersonInput.focus();
      }
    });

    splitAddPersonInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const val = splitAddPersonInput.value.trim();
        if (val) {
          addPersonToSplit(val);
          splitAddPersonInput.value = '';
        }
      }
    });

    splitClearAllPeopleBtn.addEventListener('click', () => {
      clearAllSplitPeople();
    });
  }

  function addPersonToSplit(name) {
    if (!name) return;
    const cleanName = name.trim();
    if (splitSelectedPeople.some(p => p.toLowerCase() === cleanName.toLowerCase())) {
      return;
    }
    splitSelectedPeople.push(cleanName);
    setFieldError(splitPeopleError, null);
    renderSplitSelectedPeople();
    renderSplitQuickSuggestions();
    updateSplitPreview();
  }

  window.removePersonFromSplit = function(name) {
    splitSelectedPeople = splitSelectedPeople.filter(p => p.toLowerCase() !== name.toLowerCase());
    renderSplitSelectedPeople();
    renderSplitQuickSuggestions();
    updateSplitPreview();
  };

  function clearAllSplitPeople() {
    splitSelectedPeople = [];
    renderSplitSelectedPeople();
    renderSplitQuickSuggestions();
    updateSplitPreview();
  }

  function renderSplitSelectedPeople() {
    const cur = t();
    splitPeopleCount.textContent = splitSelectedPeople.length;
    splitClearAllPeopleBtn.style.display = splitSelectedPeople.length > 1 ? 'inline' : 'none';

    if (splitSelectedPeople.length === 0) {
      splitSelectedPeopleList.innerHTML = `<span class="selected-empty-hint">${cur.selectedEmptyHint}</span>`;
      return;
    }

    splitSelectedPeopleList.innerHTML = splitSelectedPeople.map(p => {
      const initial = p.charAt(0).toUpperCase();
      return `
        <div class="selected-person-chip">
          <span class="chip-avatar">${initial}</span>
          <span>${escapeHtml(p)}</span>
          <button type="button" class="chip-remove-btn" onclick="removePersonFromSplit('${escapeHtml(p)}')" title="Usuń">&times;</button>
        </div>
      `;
    }).join('');
  }

  function renderSplitQuickSuggestions() {
    const payer = splitPayerInput.value.trim().toLowerCase();
    const suggestions = knownPeopleList.filter(p => p.toLowerCase() !== payer);

    if (suggestions.length === 0) {
      splitQuickSuggestions.innerHTML = `<span style="font-size: 11px; color: var(--text-muted); font-style: italic;">${currentLang === 'en' ? 'No saved contacts yet' : 'Brak innych kontaktów w bazie'}</span>`;
      return;
    }

    splitQuickSuggestions.innerHTML = suggestions.map(p => {
      const isSelected = splitSelectedPeople.some(sp => sp.toLowerCase() === p.toLowerCase());
      const initial = p.charAt(0).toUpperCase();
      return `
        <button type="button" class="suggest-pill ${isSelected ? 'is-selected' : ''}" onclick="toggleSplitSuggestion('${escapeHtml(p)}')">
          <span class="suggest-avatar">${initial}</span>
          <span>${escapeHtml(p)}</span>
          <span class="suggest-icon">${isSelected ? '✓' : '+'}</span>
        </button>
      `;
    }).join('');
  }

  window.toggleSplitSuggestion = function(name) {
    const isSelected = splitSelectedPeople.some(p => p.toLowerCase() === name.toLowerCase());
    if (isSelected) {
      removePersonFromSplit(name);
    } else {
      addPersonToSplit(name);
    }
  };

  function setupSplitPreview() {
    splitTotalInput.addEventListener('input', updateSplitPreview);
    splitCurrency.addEventListener('change', updateSplitPreview);
    splitPayerInput.addEventListener('input', () => {
      renderSplitQuickSuggestions();
      updateSplitPreview();
    });
    splitIncludePayer.addEventListener('change', updateSplitPreview);
  }

  function updateSplitPreview() {
    const cur = t();
    const payer = splitPayerInput.value.trim() || (currentLang === 'en' ? 'Payer' : 'Płacący');
    const total = parseFloat(splitTotalInput.value);
    const curr = splitCurrency.value || 'PLN';
    const filteredPeople = splitSelectedPeople.filter(p => p.toLowerCase() !== payer.toLowerCase());
    const includePayer = splitIncludePayer.checked;

    if (isNaN(total) || total <= 0 || filteredPeople.length === 0) {
      splitPreviewText.textContent = cur.splitPreviewEmpty;
      return;
    }

    const divisor = includePayer ? (filteredPeople.length + 1) : filteredPeople.length;
    const perPerson = total / divisor;

    splitPreviewText.innerHTML = cur.splitPreviewResult(formatCurrency(perPerson, curr), filteredPeople.length, payer);
  }

  // =========================================================================
  // WALIDACJA FORMULARZY
  // =========================================================================
  function setFieldError(errorEl, message, inputEl = null) {
    if (!errorEl) return;
    if (message) {
      errorEl.textContent = message;
      errorEl.classList.add('show');
      if (inputEl) inputEl.classList.add('is-invalid');
    } else {
      errorEl.textContent = '';
      errorEl.classList.remove('show');
      if (inputEl) inputEl.classList.remove('is-invalid');
    }
  }

  function clearAllFormErrors() {
    [debtorError, creditorError, amountError, splitPayerError, splitTotalError, splitTitleError, splitPeopleError, payPartialError].forEach(el => {
      if (el) setFieldError(el, null);
    });
    [debtorInput, creditorInput, debtAmountInput, splitPayerInput, splitTotalInput, splitTitleInput, splitAddPersonInput, payPartialAmountInput].forEach(inp => {
      if (inp) inp.classList.remove('is-invalid');
    });
  }

  function setupModals() {
    openAddModalBtn.addEventListener('click', () => {
      addDebtForm.reset();
      splitBillForm.reset();
      clearAllFormErrors();
      splitSelectedPeople = [];
      
      if (activeProfile && activeProfile !== '__ALL__') {
        creditorInput.value = activeProfile;
        splitPayerInput.value = activeProfile;
      }

      renderSplitSelectedPeople();
      renderSplitQuickSuggestions();
      updateSplitPreview();
      addModal.classList.add('active');
      debtorInput.focus();
    });

    document.querySelectorAll('.modal-mode-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.modal-mode-tab').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.mode-form').forEach(f => f.classList.remove('active'));
        clearAllFormErrors();

        btn.classList.add('active');
        const mode = btn.getAttribute('data-mode');
        if (mode === 'single') {
          addDebtForm.classList.add('active');
          debtorInput.focus();
        } else {
          splitBillForm.classList.add('active');
          splitPayerInput.focus();
          renderSplitSelectedPeople();
          renderSplitQuickSuggestions();
          updateSplitPreview();
        }
      });
    });

    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => {
        const modalId = btn.getAttribute('data-close');
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.remove('active');
      });
    });

    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.classList.remove('active');
      });
    });

    // Clear live errors on input
    debtorInput.addEventListener('input', () => setFieldError(debtorError, null, debtorInput));
    creditorInput.addEventListener('input', () => setFieldError(creditorError, null, creditorInput));
    debtAmountInput.addEventListener('input', () => setFieldError(amountError, null, debtAmountInput));
    splitPayerInput.addEventListener('input', () => setFieldError(splitPayerError, null, splitPayerInput));
    splitTotalInput.addEventListener('input', () => setFieldError(splitTotalError, null, splitTotalInput));
    splitTitleInput.addEventListener('input', () => setFieldError(splitTitleError, null, splitTitleInput));
    payPartialAmountInput.addEventListener('input', () => setFieldError(payPartialError, null, payPartialAmountInput));

    // Zapis pojedynczego wpisu
    addDebtForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const cur = t();
      clearAllFormErrors();

      const debtor = debtorInput.value.trim();
      const creditor = creditorInput.value.trim();
      const amount = parseFloat(debtAmountInput.value);
      const curr = debtCurrency.value || 'PLN';
      const title = debtTitleInput.value.trim() || (currentLang === 'en' ? 'Settlement' : 'Rozliczenie');

      let hasError = false;

      if (!debtor) {
        setFieldError(debtorError, cur.errDebtorReq, debtorInput);
        hasError = true;
      }
      if (!creditor) {
        setFieldError(creditorError, cur.errCreditorReq, creditorInput);
        hasError = true;
      }

      if (debtor && creditor && debtor.toLowerCase() === creditor.toLowerCase()) {
        setFieldError(creditorError, cur.errSamePerson, creditorInput);
        hasError = true;
      }

      if (isNaN(amount) || amount <= 0) {
        setFieldError(amountError, cur.errAmountPos, debtAmountInput);
        hasError = true;
      }

      if (hasError) return;

      try {
        const res = await fetch('/api/debts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            debtor_name: debtor,
            creditor_name: creditor,
            amount: amount,
            currency: curr,
            title: title
          })
        });

        const data = await res.json();
        if (!res.ok) {
          showToast(data.error || 'Błąd zapisu', 'error');
          return;
        }

        addModal.classList.remove('active');
        showToast(cur.toastDebtAdded, 'success');
        await loadData();
      } catch (err) {
        showToast('Błąd połączenia z serwerem.', 'error');
      }
    });

    // Zapis podziału rachunku (Zrzutka)
    splitBillForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const cur = t();
      clearAllFormErrors();

      const payer = splitPayerInput.value.trim();
      const totalAmount = parseFloat(splitTotalInput.value);
      const curr = splitCurrency.value || 'PLN';
      const title = splitTitleInput.value.trim();
      const includePayer = splitIncludePayer.checked;

      let hasError = false;

      if (!payer) {
        setFieldError(splitPayerError, cur.errPayerReq, splitPayerInput);
        hasError = true;
      }

      if (isNaN(totalAmount) || totalAmount <= 0) {
        setFieldError(splitTotalError, cur.errAmountPos, splitTotalInput);
        hasError = true;
      }

      if (!title) {
        setFieldError(splitTitleError, cur.errSplitTitleReq, splitTitleInput);
        hasError = true;
      }

      const peopleList = splitSelectedPeople.filter(p => p.toLowerCase() !== payer.toLowerCase());
      if (peopleList.length === 0) {
        setFieldError(splitPeopleError, cur.errSplitPeopleReq, splitAddPersonInput);
        hasError = true;
      }

      if (hasError) return;

      try {
        const res = await fetch('/api/debts/split', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            payer_name: payer,
            total_amount: totalAmount,
            currency: curr,
            title: title,
            people: peopleList,
            include_payer: includePayer
          })
        });

        const data = await res.json();
        if (!res.ok) {
          showToast(data.error || 'Błąd zapisu', 'error');
          return;
        }

        addModal.classList.remove('active');
        showToast(cur.toastSplitAdded, 'success');
        await loadData();
      } catch (err) {
        showToast('Błąd połączenia z serwerem.', 'error');
      }
    });

    // Spłata częściowa
    payPartialForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const cur = t();
      setFieldError(payPartialError, null, payPartialAmountInput);

      const debtId = payPartialDebtId.value;
      const amount = parseFloat(payPartialAmountInput.value);

      if (isNaN(amount) || amount <= 0) {
        setFieldError(payPartialError, cur.errAmountPos, payPartialAmountInput);
        return;
      }

      if (currentPartialDebt && amount > currentPartialDebt.remaining_amount + 0.005) {
        setFieldError(payPartialError, cur.errPayAmountMax(formatCurrency(currentPartialDebt.remaining_amount, currentPartialDebt.currency)), payPartialAmountInput);
        return;
      }

      try {
        const res = await fetch(`/api/debts/${debtId}/pay`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: amount, note: currentLang === 'en' ? 'Partial payment' : 'Częściowa spłata' })
        });

        const data = await res.json();
        if (!res.ok) {
          setFieldError(payPartialError, data.error || 'Błąd', payPartialAmountInput);
          return;
        }

        payPartialModal.classList.remove('active');
        showToast(cur.toastPartialPaid, 'success');
        await loadData();
      } catch (err) {
        showToast('Błąd połączenia z serwerem.', 'error');
      }
    });
  }

  function setupQuickPayChips() {
    document.querySelectorAll('.chip-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!currentPartialDebt) return;
        const ratio = parseFloat(btn.getAttribute('data-ratio'));
        const calc = (currentPartialDebt.remaining_amount * ratio).toFixed(2);
        payPartialAmountInput.value = calc;
        setFieldError(payPartialError, null, payPartialAmountInput);
      });
    });
  }

  function setupFilters() {
    filterTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        filterTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentFilter = tab.getAttribute('data-filter');
        renderList();
      });
    });

    personFilter.addEventListener('change', (e) => {
      selectedFilterPerson = e.target.value;
      renderPeopleBalances();
      renderList();
    });

    filterSearch.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      clearSearchBtn.style.display = searchQuery ? 'block' : 'none';
      renderList();
    });

    clearSearchBtn.addEventListener('click', () => {
      filterSearch.value = '';
      searchQuery = '';
      clearSearchBtn.style.display = 'none';
      renderList();
    });

    clearPersonFilterBtn.addEventListener('click', () => {
      filterByPerson('ALL');
    });
  }

  // =========================================================================
  // OPERACJE NA DŁUGACH (SETTLE, PAY, HISTORY, DELETE)
  // =========================================================================
  window.settleFullDebt = function(id) {
    const debt = debtsData.find(d => d.id === id);
    if (!debt) return;
    const cur = t();

    showConfirmDialog({
      title: cur.btnSettle,
      message: cur.confirmSettle(debt.debtor_name, debt.creditor_name, formatCurrency(debt.remaining_amount, debt.currency)),
      confirmText: cur.btnSettle,
      isDanger: false,
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/debts/${id}/settle`, { method: 'POST' });
          if (!res.ok) throw new Error();
          showToast(cur.toastSettled, 'success');
          await loadData();
        } catch (err) {
          showToast('Nie udało się rozliczyć wpisu.', 'error');
        }
      }
    });
  };

  window.openPartialPayModal = function(id) {
    const debt = debtsData.find(d => d.id === id);
    if (!debt) return;
    const cur = t();
    currentPartialDebt = debt;
    setFieldError(payPartialError, null, payPartialAmountInput);

    payPartialDebtId.value = debt.id;
    payPartialAmountInput.value = '';
    payPartialAmountInput.placeholder = `max ${debt.remaining_amount.toFixed(2)}`;
    payPartialAmountInput.max = debt.remaining_amount;

    payPartialInfo.innerHTML = cur.payPartialInfoText(
      debt.debtor_name,
      debt.creditor_name,
      debt.title,
      formatCurrency(debt.remaining_amount, debt.currency)
    );
    payPartialModal.classList.add('active');
    payPartialAmountInput.focus();
  };

  window.openHistoryModal = function(id) {
    const debt = debtsData.find(d => d.id === id);
    if (!debt) return;
    const cur = t();

    historyModalInfo.innerHTML = cur.historyModalInfoText(
      debt.debtor_name,
      debt.creditor_name,
      debt.title,
      formatCurrency(debt.amount, debt.currency),
      formatCurrency(debt.remaining_amount, debt.currency)
    );

    const payments = debt.payments || [];
    if (payments.length === 0) {
      historyPaymentsList.innerHTML = `<p class="empty-subtitle" style="padding: 12px 0;">${cur.historyEmpty}</p>`;
    } else {
      historyPaymentsList.innerHTML = payments.map(p => `
        <div class="history-item">
          <div class="history-item-left">
            <span class="history-amount">+${formatCurrency(p.amount, debt.currency)}</span>
            <span class="history-date">${p.payment_date} ${p.note ? `• ${escapeHtml(p.note)}` : ''}</span>
          </div>
          <button type="button" class="history-item-btn" onclick="deletePayment(${p.id})">
            ${cur.btnUndoPayment}
          </button>
        </div>
      `).join('');
    }

    historyModal.classList.add('active');
  };

  window.deletePayment = function(paymentId) {
    const cur = t();
    showConfirmDialog({
      title: cur.btnUndoPayment,
      message: cur.confirmUndoPayment,
      confirmText: cur.btnUndoPayment,
      isDanger: true,
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/debts/payments/${paymentId}`, { method: 'DELETE' });
          if (!res.ok) throw new Error();
          historyModal.classList.remove('active');
          showToast(cur.toastPaymentUndone, 'info');
          await loadData();
        } catch (err) {
          showToast('Nie udało się cofnąć wpłaty.', 'error');
        }
      }
    });
  };

  window.deleteDebt = function(id) {
    const cur = t();
    showConfirmDialog({
      title: cur.btnDelete,
      message: cur.confirmDelete,
      confirmText: cur.btnDelete,
      isDanger: true,
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/debts/${id}`, { method: 'DELETE' });
          if (!res.ok) throw new Error();
          showToast(cur.toastDeleted, 'info');
          await loadData();
        } catch (err) {
          showToast('Nie udało się usunąć rozliczenia.', 'error');
        }
      }
    });
  };

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, m => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[m]));
  }
});
