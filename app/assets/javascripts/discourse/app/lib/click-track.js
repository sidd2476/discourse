import DiscourseURL from "discourse/lib/url";
import I18n from "I18n";
import { Promise } from "rsvp";
import User from "discourse/models/user";
import { ajax } from "discourse/lib/ajax";
import getURL, { samePrefix } from "discourse-common/lib/get-url";
import { isTesting } from "discourse-common/config/environment";
import { selectedText } from "discourse/lib/utilities";
import { wantsNewWindow } from "discourse/lib/intercept-click";
import deprecated from "discourse-common/lib/deprecated";
import { getOwner } from "discourse-common/lib/get-owner";
import jQuery from "jquery";

export function isValidLink(link) {
  if (link instanceof jQuery) {
    link = link[0];

    deprecated("isValidLink now expects an Element, not a jQuery object", {
      since: "2.9.0.beta7",
      id: "discourse.click-track.is-valid-link-jquery",
    });
  }

  // .hashtag/.hashtag-cooked == category/tag link
  // .back == quote back ^ button
  if (
    ["lightbox", "no-track-link", "hashtag", "hashtag-cooked", "back"].some(
      (name) => link.classList.contains(name)
    )
  ) {
    return false;
  }

  const closest = link.closest("aside.quote, .elided, .expanded-embed");
  if (closest && closest !== link) {
    return false;
  }

  if (link.closest(".onebox-result, .onebox-body")) {
    const a = link.closest(".onebox")?.querySelector("header a");

    if (a && a.href === link.href) {
      return true;
    }
  }

  return (
    link.classList.contains("track-link") ||
    !link.closest(
      ".hashtag, .hashtag-cooked, .badge-category, .onebox-result, .onebox-body"
    )
  );
}

export function shouldOpenInNewTab(href) {
  const isInternal = DiscourseURL.isInternal(href);
  const openExternalInNewTab = User.currentProp(
    "user_option.external_links_in_new_tab"
  );
  return !isInternal && openExternalInNewTab;
}

export function openLinkInNewTab(event, link) {
  let href = (link.href || link.dataset.href || "").trim();
  if (href === "") {
    return;
  }

  const newWindow = window.open(href, "_blank");
  newWindow.opener = null;
  newWindow.focus();

  event.preventDefault();
}

export default {
  trackClick(e, siteSettings, { returnPromise = false } = {}) {
    // right clicks are not tracked
    if (e.which === 3) {
      return true;
    }

    // Cancel click if triggered as part of selection.
    const selection = window.getSelection();
    if (selection.type === "Range" || selection.rangeCount > 0) {
      if (selectedText() !== "") {
        return true;
      }
    }

    const link = e.currentTarget;
    const tracking = isValidLink(link);

    // Return early for mentions and group mentions. This is not in
    // isValidLink because returning true here allows the group card
    // to pop up. If we returned false it would not.
    if (
      ["mention", "mention-group"].some((name) => link.classList.contains(name))
    ) {
      return true;
    }

    let href = (link.getAttribute("href") || link.dataset.href || "").trim();
    if (!href || href.startsWith("mailto:")) {
      return true;
    }

    if (link.classList.contains("attachment")) {
      // Warn the user if they cannot download the file.
      if (
        siteSettings?.prevent_anons_from_downloading_files &&
        !User.current()
      ) {
        const dialog = getOwner(this).lookup("service:dialog");
        dialog.alert(I18n.t("post.errors.attachment_download_requires_login"));
      } else if (wantsNewWindow(e)) {
        const newWindow = window.open(href, "_blank");
        newWindow.opener = null;
        newWindow.focus();
      } else {
        DiscourseURL.redirectTo(href);
      }
      return false;
    }

    const article = link.closest(
      "article:not(.onebox-body), .excerpt, #revisions"
    );
    const postId = article.dataset.postId;
    const topicId =
      document.querySelector("#topic")?.dataset?.topicId ||
      article.dataset.topicId;
    const userId = link.dataset.userId || article.dataset.userId;
    const ownLink = userId && parseInt(userId, 10) === User.currentProp("id");

    // Update badge clicks unless it's our own.
    if (tracking && !ownLink) {
      const badge = link.querySelector("span.badge");

      if (badge) {
        const html = badge.innerHTML;
        const key = `${new Date().toLocaleDateString()}-${postId}-${href}`;

        if (/^\d+$/.test(html) && !sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, true);
          badge.innerHTML = parseInt(html, 10) + 1;
        }
      }
    }

    let trackPromise = Promise.resolve();
    if (tracking) {
      if (!isTesting() && navigator.sendBeacon) {
        const data = new FormData();
        data.append("url", href);
        data.append("post_id", postId);
        data.append("topic_id", topicId);
        navigator.sendBeacon(getURL("/clicks/track"), data);
      } else {
        trackPromise = ajax(getURL("/clicks/track"), {
          type: "POST",
          data: {
            url: href,
            post_id: postId,
            topic_id: topicId,
          },
        });
      }
    }

    if (!wantsNewWindow(e)) {
      if (shouldOpenInNewTab(href)) {
        openLinkInNewTab(e, link);
      } else {
        trackPromise.finally(() => {
          if (DiscourseURL.isInternal(href) && samePrefix(href)) {
            DiscourseURL.routeTo(href);
          } else {
            DiscourseURL.redirectAbsolute(href);
          }
        });
      }

      return returnPromise ? trackPromise : false;
    }

    return returnPromise ? trackPromise : true;
  },
};
