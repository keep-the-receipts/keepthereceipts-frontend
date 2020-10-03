class PurchaseRecord {
  constructor(template, resultsItem) {
    this.element = template.clone();
    const contentRowDemo = this.element.find(".row-content__item");
    this.contentRowTemplate = contentRowDemo.first().clone();
    contentRowDemo.remove();
    this.contentRowContainer = this.element.find(".row-content__inner");
    const supplierNameEl = this.element.find(".row-title");
    supplierNameEl.text(resultsItem.supplier_name);
    supplierNameEl.attr("title", resultsItem.supplier_name);

    const buyerNameEl = this.element.find(".row-body:first");
    buyerNameEl.text(resultsItem.buyer_name);
    buyerNameEl.attr("title", resultsItem.buyer_name);
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

    for (let field in resultsItem) {
      if (resultsItem[field] !== null && resultsItem[field] !== "") {
        const rowEl = this.contentRowTemplate.clone();
        rowEl.find(".label").text(field);
        rowEl.find(".description-block").text(resultsItem[field]);
        this.contentRowContainer.append(rowEl);
      }
    }
  }
}

export class ResultsList {
  constructor() {
    this.element = $(".filtered-list");
    this.loadMoreButton = null;
    this.resultRowTemplate = null;
    const loadingRowDemo = $(".filtered-list__loading");
    this.loadingRowTemplate = loadingRowDemo.clone();
    const rows = $(".row-dropdown");
    this.resultRowTemplate = rows.first().clone();
    rows.remove();
    const loadMoreButtonDemo = $("#load-more");
    this.loadMoreButtonTemplate = loadMoreButtonDemo.clone();
    this.reset();
  }

  startLoading() {
    this.element.append(this.loadingRowTemplate.clone());
  }

  stopLoading() {
    $(".filtered-list__loading").remove();
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
    $(".row-dropdown").remove();
  }
}
