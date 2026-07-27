/* Shared chrome behaviour: mobile nav toggle + active nav link. */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    var toggle = document.querySelector('.nav-toggle');
    var links = document.querySelector('.visible-links');
    if (toggle && links) {
      toggle.addEventListener('click', function () {
        links.classList.toggle('is-open');
      });
    }

    // Mark the current page in the masthead.
    var page = document.body.getAttribute('data-page');
    if (page) {
      var current = document.querySelector('.visible-links a[data-nav="' + page + '"]');
      if (current) current.classList.add('active');
    }
  });
})();
