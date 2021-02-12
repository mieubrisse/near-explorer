/// <reference types="Cypress" />

context("Blocks", () => {
  beforeEach(() => {
    cy.visit("http://localhost:3000/blocks");
  });

  it("Check page title", () => {
    cy.title().should("contain", "Blocks");
  });

  it("Check blocks row data", () => {
    cy.wait(5000).get(".infinite-scroll-component__outerdiv").should("exist");
    cy.get(".infinite-scroll-component__outerdiv .infinite-scroll-component")
      .find("a .transaction-row")
      .should("have.length.greaterThan", 0)
      .and("not.be.empty");
    cy.get(".infinite-scroll-component__outerdiv .infinite-scroll-component")
      .find("a .transaction-row .transaction-row-title")
      .should("not.be.empty");
    cy.get(".infinite-scroll-component__outerdiv .infinite-scroll-component")
      .find("a .transaction-row .transaction-row-txid")
      .should("not.be.empty");
  });

  it("Check block details", () => {
    cy.wait(5000).get(".infinite-scroll-component__outerdiv").should("exist");
    cy.get(".infinite-scroll-component__outerdiv .infinite-scroll-component")
      .find("a .transaction-row")
      .first()
      .click();
    cy.wait(5000);
    cy.get(".block-info-container").should("exist");
    cy.get(".block-info-container .card-cell .card-body")
      .should("exist")
      .and("not.be.empty");

    cy.get(".content-title").then(($el) => {
      if (
        $el.children("h2").length > 0 &&
        $el.children("h2").text() === "Transactions"
      ) {
        cy.get(".infinite-scroll-component__outerdiv").should("exist");
        cy.get(
          ".infinite-scroll-component__outerdiv .infinite-scroll-component"
        ).then(($childEl) => {
          if ($childEl.find(".action-sparse-row").length > 0) {
            cy.get($childEl)
              .find(".action-sparse-row")
              .should("exist")
              .and("not.be.empty");
          } else {
            cy.log("there is no transactions");
          }
        });
      }
    });
  });
});
