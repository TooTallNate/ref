
/**
 * Animated scroll to named anchors.
 */

$(document.body).on('click', 'a', function () {
  var href = $(this).attr('href')
  if (href[0] === '#') {
    scrollTo(href)
    window.history && history.pushState({}, name, href)
    return false
  }
})

function scrollTo (hash) {
  var name = hash.substring(1)
  var target = $('a[name="' + name + '"]')
  $('html, body').animate({ scrollTop: $(target).offset().top }
    , { duration: 500, easing: 'swing'})
  return target
}
