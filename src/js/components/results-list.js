import {formatRand, humaniseRand} from '../util.js';

class RowDropdown {
  template = $(".styles > .row-dropdown");

  constructor(resultsItem) {
    this.element = this.template.clone();
    console.assert(this.element.length === 1);

    const contentRowDemo = this.element.find(".row-content__item");
    this.contentRowTemplate = contentRowDemo.first().clone();
    contentRowDemo.remove();

    this.contentRowContainer = this.element.find(".row-content__inner");

    const supplierNameEl = this.element.find(".row-title");
    console.assert(supplierNameEl.length === 1);
    supplierNameEl.text(resultsItem.supplier_name);
    supplierNameEl.attr("title", resultsItem.supplier_name);

    const buyerNameEl = this.element.find(".row-body:first");
    console.assert(buyerNameEl.length === 1);
    buyerNameEl.text(resultsItem.buyer_name);
    buyerNameEl.attr("title", resultsItem.buyer_name);

    const orderAmountEl = this.element.find(".row-body:last");
    console.assert(orderAmountEl.length === 1);
    orderAmountEl.text(humaniseRand(resultsItem.order_amount_zar));
    orderAmountEl.attr("title", formatRand(resultsItem.order_amount_zar, 2));

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

    const addDetail = (keys, value) => {
      for (let key in value) {
        if (key === "id")
          continue;

        const nestedKey = [...keys, key];
        const nestedValue = value[key];
        if (typeof(nestedValue) === "object") {
          addDetail(nestedKey, nestedValue);
        } else if (nestedValue !== null && nestedValue !== "") {
          const item = new RowDropdownItem(this.contentRowTemplate, nestedKey.join("."), nestedValue);
          this.contentRowContainer.append(item.element);
        }
      }
    };
    addDetail([], resultsItem);
  }
}

class RowDropdownItem {
  constructor(template, key, value) {
    this.element = template.clone();
    this.element.find(".label").text(key);
    this.element.find(".label").attr("title", key);
    const valueContainer = this.element.find(".description-block");
    if (/^https?:\/\/\w+\.\w+.+/.exec(value)) {
      // Create HTML from strings we control, and insert untrusted content as text (not html)
      const $a = $(`<a href="#"></a>`);
      $a.attr("href", value);
      $a.text(value);
      valueContainer.empty();
      valueContainer.append($a);
    } else {
      const formattedValue = (value && key.endsWith("_zar")) ? formatRand(value, 2) : value;
      valueContainer.text(formattedValue);
      valueContainer.attr("title", formattedValue);
    }
  }
}

export class ResultsList {
  constructor() {
    this.element = $(".main .filtered-list");
    console.assert(this.element.length === 1);

    const loadingRowDemo = $(".filtered-list__loading");
    this.loadingRowTemplate = loadingRowDemo.clone();
    console.assert(this.loadingRowTemplate.length === 1);

    const loadMoreButtonDemo = $("#load-more");
    this.loadMoreButtonTemplate = loadMoreButtonDemo.clone();
    console.assert(this.loadMoreButtonTemplate.length === 1);

    this.reset();
  }

  startLoading() {
    this.element.append(this.loadingRowTemplate.clone());
  }

  stopLoading() {
    this.element.find(".filtered-list__loading").remove();
  }

  addResults(results, nextCallback) {
    if (results.length) {
      // getNoResultsMessage().hide();
      results.forEach(item => {
        let purchaseRecord = new RowDropdown(item);
        this.element.append(purchaseRecord.element);
      });

      if (nextCallback !== null) {
        this.loadMoreButton = this.loadMoreButtonTemplate.clone();
        this.loadMoreButton.on("click", (e) => {
          e.preventDefault();
          $("#load-more").remove();
          nextCallback();
        });
        this.element.append(this.loadMoreButton);
      }
    } else {
      // getNoResultsMessage().show();
    }
  }

  reset() {
    if (this.loadMoreButton)
      $("#load-more").remove();
    this.element.find(".row-dropdown").remove();
  }
}
