/**************************************************************
  Style vision:
    It would be nice if there weren't a million things updating
    and reading pageState but it seems necessary for event handlers
    to figure out the right thing to do.

  pageState is module-global and initialises fields that will be
  used later.

  searchPage is called only on the search page, and initialises
  things dependent on the page markup.

  Each interaction that should trigger a search updates pageState
  if needed (e.g. if it was a dropdown selection, it updates the
  relevant pageState.filters field) and then calls triggerSearch.

  triggerSearch always looks at the current pageState and starts
  the search requests based on that.

  The success handler of each of the search request updates anything
  it needs to in pageState, and updates the UI to reflect the response
  from the server.

  ajax requests should always cancel the relevant previous request
  if it's still in flight before being sent, and should always have
  an error handler giving some user feedback as well as technical
  information in the console to notice and understand errors.
/***************************************************************/

import {SingleDeleteURLSearchParams as URLSearchParams} from './url-search-params.js';


const baseLocation = "https://data.keepthereceipt.org.za/api/purchase_records/";

const facetPlurals = {
  government_label: "governments",
  sector: "sectors",
  department: "departments",
  status: "project statuses",
  primary_funding_source: "funding sources",
};


// const getNoResultsMessage = () => $("#result-list-container * .w-dyn-empty");

const fullTextNameToQueryField = {
  "Filter-by-supplier": "supplier_full_text",
  "Filter-by-director-name": "directors_full_text",
  "Filter-by-item-description": "description_full_text",
  "Filter-by-procurement-method": "procurement_method_full_text",
};

class DropdownOption {
  constructor(activeTemplate, inactiveTemplate, selectHandler, deselectHandler, optionItem) {
    if (optionItem.selected) {
      this.element = activeTemplate.clone();
      this.element.click((e => {
        deselectHandler(optionItem.label);
        e.preventDefault();
      }).bind(this));
    } else {
      this.element = inactiveTemplate.clone();
      this.element.click((e => {
        selectHandler(optionItem.label);
        e.preventDefault();
      }).bind(this));
    }
    this.element.find(".dropdown-link__text").text(optionItem.label);
    this.element.find(".facet-count").text(optionItem.count);
  }
}

class DropdownField {
  constructor(element, queryField) {
    this.element = element;
    this.queryField = queryField;
    this.addFilterHandlers = [];
    this.removeFilterHandlers = [];
    this.activeOptionTemplate = element.find(".dropdown-list__active").clone();
    this.inactiveOptionTemplate = element.find(".dropdown-list__links").clone();
    this.activeOptionTemplate.find(".dropdown-link__text").text("");
    this.activeOptionTemplate.find(".dropdown-link__text + div").addClass("facet-count").text("");
    this.inactiveOptionTemplate.find(".dropdown-link__text").text("");
    this.inactiveOptionTemplate.find(".dropdown-link__text + div").addClass("facet-count").text("");

    this.reset();
  }

  addAddFilterHandler(handler) {
    this.addFilterHandlers.push(handler);
  }
  addRemoveFilterHandler(handler) {
    this.removeFilterHandlers.push(handler);
  }
  handleOptionSelect(value) {
    this.addFilterHandlers.forEach((f => f(this.queryField, value)).bind(this));
  }
  handleOptionDeselect(value) {
    this.removeFilterHandlers.forEach((f => f(this.queryField, value)).bind(this));
  }

  updateOptions(options) {
    options.forEach(optionItem => {
      const option = new DropdownOption(
        this.activeOptionTemplate,
        this.inactiveOptionTemplate,
        this.handleOptionSelect.bind(this),
        this.handleOptionDeselect.bind(this),
        optionItem
      );
      this.element.find(".dropdown-list__inner").append(option.element);
    });
  }

  reset() {
    this.element.find(".dropdown-list__active").remove();
    this.element.find(".dropdown-list__links").remove();
  }
}

class FullTextSearchField {
  constructor(element, queryField) {
    this.element = element;
    this.queryField = queryField;
    this.addFilterHandlers = [];
    this.inputElement = this.element.find(".search__bar");

    this.inputElement.keypress(e => {
      const key = e.which;
      if (key == 13) {  // the enter key code
        e.preventDefault();
        this.handleSubmit(this.inputElement.val());
      }
    });

    this.element.find(".search__add-filter").on("click", (e) => {
      e.preventDefault();
      this.handleSubmit(this.inputeElement.val());
    });
  }

  addAddFilterHandler(handler) {
    this.addFilterHandlers.push(handler);
  }

  handleSubmit(value) {
    this.addFilterHandlers.forEach((f => f(this.queryField, value)).bind(this));
  }
}

class PurchaseRecord {
  constructor(template, resultsItem) {
    this.element = template.clone();
    this.element.find(".row-title").text(resultsItem.supplier_name);
    this.element.find(".row-body:first").text(resultsItem.buyer_name);
    this.element.find(".row-body:last").text(resultsItem.amount_value_zar);

    // expand/collapse
    const rowContentEl = this.element.find(".row-content");
    const accordionToggle = this.element.find(".row-dropdown__toggle");
    const expandIcon = this.element.find(".row-icon-open");
    const collapseIcon = this.element.find(".row-icon-close");
    rowContentEl.removeAttr("style");
    rowContentEl.hide();
    expandIcon.show();
    collapseIcon.hide();
    accordionToggle.click(() => {
      expandIcon.toggle();
      collapseIcon.toggle();
      rowContentEl.slideToggle();
    });
  }
}

class ResultsList {
  constructor() {
    this.loadMoreButton = null;
    this.loadMoreButtonTemplate = null;
    this.resultRowTemplate = null;
    const rows = $(".row-dropdown");
    this.resultRowTemplate = rows.first().clone();
    rows.remove();
    const loadMoreButtonDemo = $(".load-more");
    this.loadMoreButtonTemplate = loadMoreButtonDemo.clone();
    loadMoreButtonDemo.remove();

  }

  addResults(results, nextCallback) {
    if (results.length) {
      // getNoResultsMessage().hide();
      results.forEach(item => {
        let purchaseRecord = new PurchaseRecord(this.resultRowTemplate, item);
        $(".filtered-list").append(purchaseRecord.element);
      });

      if (nextCallback !== null) {
        this.loadMoreButton = this.loadMoreButtonTemplate.clone();
        this.loadMoreButton.on("click", (e) => {
          e.preventDefault();
          this.loadMoreButton.remove();
          nextCallback();
        });
        $(".filtered-list").append(this.loadMoreButton);
      }
    } else {
      // getNoResultsMessage().show();
    }
  }

  reset() {
    if (this.loadMoreButton)
      this.loadMoreButton.remove();
    $(".row-dropdown").remove();
  }
}

class PageState {
  constructor() {
    this.listRequest = null;
    this.activeFiltersWrapper = $(".current-filters__wrap");
    this.noFilterChip = $(".no-filter");
    this.activeFilterChipTemplate = $(".current-filter").clone();
    this.activeFiltersWrapper.empty();
    this.numResultsContainer = $("#results-value strong");
    $(".filter__download").hide(); // for now
    this.resultsList = new ResultsList();
    window.addEventListener("popstate", this.handleHistoryPopstate);

    this.fullTextFields = {
      supplierName: new FullTextSearchField($("#Filter-by-supplier").parents(".search__input"), "supplier_full_text"),
    };
    for (let key in this.fullTextFields) {
      this.fullTextFields[key].addAddFilterHandler(this.addFilter.bind(this));
    }

    this.facets = {
      buyerName: new DropdownField($("#filter-buyer-name"), "buyer_name"),
      facility: new DropdownField($("#filter-facility"), "implementation_location_facility"),
      districtMuni: new DropdownField($("#filter-district-muni"), "implementation_location_district_municipality"),
      localMuni: new DropdownField($("#filter-local-muni"), "implementation_location_local_municipality"),
      // other: new DropdownField($("#filter-facility"), "implementation_location_other"),
      province: new DropdownField($("#filter-province"), "implementation_location_province"),
      repository: new DropdownField($("#filter-data-repository"), "dataset_version__dataset__repository__name"),
      dataset: new DropdownField($("#filter-source-dataset"), "dataset_version__dataset__name"),
    };
    for (let key in this.facets) {
      this.facets[key].addAddFilterHandler(this.addFilter.bind(this));
      this.facets[key].addRemoveFilterHandler(this.removeFilter.bind(this));
    }

    this.resetFacets();
    this.resultsList.reset();
    this.loadSearchStateFromCurrentURL();
    //this.initSortDropdown();
    this.triggerSearch(false);
  }

  addFilter(querystringField, value) {
    this.urlSearchParams.append(querystringField, value);
    this.triggerSearch(true);
  }
  removeFilter(querystringField, value) {
    this.urlSearchParams.deleteMatching(querystringField, value);
    this.triggerSearch(true);
  }


  updateFacetOptions(facets) {
    this.facets.buyerName.updateOptions(facets[this.facets.buyerName.queryField]);
    this.facets.facility.updateOptions(facets[this.facets.facility.queryField]);
    this.facets.districtMuni.updateOptions(facets[this.facets.districtMuni.queryField]);
    this.facets.localMuni.updateOptions(facets[this.facets.localMuni.queryField]);
    this.facets.province.updateOptions(facets[this.facets.province.queryField]);
    this.facets.repository.updateOptions(facets[this.facets.repository.queryField]);
    this.facets.dataset.updateOptions(facets[this.facets.dataset.queryField]);
  }
  resetFacets() {
    this.facets.buyerName.reset();
    this.facets.facility.reset();
    this.facets.districtMuni.reset();
    this.facets.localMuni.reset();
    this.facets.province.reset();
    this.facets.repository.reset();
    this.facets.dataset.reset();
  }

  resetResults() {
    this.numResultsContainer.text("...");
    this.resultsList.reset();
    // getNoResultsMessage().hide();
  }

  fetchAndDisplay(url) {
    if (this.listRequest !== null)
      this.listRequest.abort();

    this.listRequest = $.get(url)
      .done((response) => {
        this.populateDownloadCSVButton(response);
        this.numResultsContainer.text(`${response.results.length} of ${response.count}`);
        const nextCallback = response.next ? () => this.fetchAndDisplay(response.next) : null;
        this.resultsList.addResults(response.results, nextCallback);
        this.resetFacets();
        this.updateFacetOptions(response.meta.facets);
      })
      .fail(function(jqXHR, textStatus, errorThrown) {
        if (textStatus !== "abort") {
          alert("Something went wrong when searching. Please try again.");
          console.error( jqXHR, textStatus, errorThrown );
        }
      });
  }

  handleHistoryPopstate(event) {
    this.loadSearchStateFromCurrentURL();
    this.triggerSearch(false);
  }

  pushState() {
    window.history.pushState(null, "", this.pageUrl());
  }

  loadSearchStateFromCurrentURL() {
    const queryString = window.location.search.substring(1);
    this.urlSearchParams = new URLSearchParams(queryString);

    // const sortField = params.get("order_by");
    // pageState.sortField = sortField || "status_order";
  }

  pageUrl() {
    const queryString = this.urlSearchParams.toString();
    return `${window.location.protocol}//${window.location.host}${window.location.pathname}?${queryString}`;
  }

  buildListSearchURL() {
    return baseLocation + "?" + this.urlSearchParams.toString();
  }

  triggerSearch(pushHistory = true) {
    if (pushHistory)
      this.pushState();

    this.resetResults();
    this.fetchAndDisplay(this.buildListSearchURL());
  };

  populateDownloadCSVButton(response) {
    $("#search-results-download-button").attr("href", response.csv_download_url);
  }

}


// function initSortDropdown() {
//   const selector = "#sort-order-dropdown";
//   const dropdownItemTemplate = $("#sort-order-dropdown * .dropdown-link--small:first");
//   dropdownItemTemplate.find(".sorting-status").remove();
//   dropdownItemTemplate.find(".dropdown-label").text("");
//   $(selector).find(".text-block").text("");
//   $(selector).find(".dropdown-link--small").remove();
//
//   var container = $(selector);
//   var optionContainer = container.find(".sorting-dropdown_list");
//
//   container.find(".text-block").text(sortOptions.get(pageState.sortField));
//
//   sortOptions.forEach((label, key) => {
//     const optionElement = dropdownItemTemplate.clone();
//     optionElement.find(".dropdown-label").text(label);
//     optionElement.click(function(e) {
//       e.preventDefault();
//       container.find(".text-block").text(label);
//       pageState.sortField = key;
//       optionContainer.removeClass("w--open");
//       triggerSearch();
//     });
//     optionContainer.append(optionElement);
//   });
// }


const pageState = new PageState();
