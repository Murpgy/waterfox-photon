/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "builtin/intl/GlobalIntlData.h"

#include "mozilla/Assertions.h"
#include "mozilla/Span.h"

#include "builtin/intl/Collator.h"
#include "builtin/intl/CommonFunctions.h"
#include "builtin/intl/DateTimeFormat.h"
#include "builtin/intl/FormatBuffer.h"
#include "builtin/intl/LocaleNegotiation.h"
#include "builtin/intl/NumberFormat.h"
#include "builtin/temporal/TimeZone.h"
#include "gc/Tracer.h"
#include "js/Prefs.h"
#include "js/RootingAPI.h"
#include "js/TracingAPI.h"
#include "js/Value.h"
#include "vm/DateTime.h"
#include "vm/JSContext.h"
#include "vm/Realm.h"

#include "vm/JSObject-inl.h"

using namespace js;
using namespace js::intl;

void js::intl::GlobalIntlData::resetCollator() {
  collatorLocale_ = nullptr;
  collator_ = nullptr;
  for (auto& entry : collatorOptionful_) {
    entry.locale_ = nullptr;
    entry.options_ = nullptr;
    entry.formatter_ = nullptr;
  }
  collatorOptionfulNext_ = 0;
}

void js::intl::GlobalIntlData::resetNumberFormat() {
  numberFormatLocale_ = nullptr;
  numberFormat_ = nullptr;
  for (auto& entry : numberFormatOptionful_) {
    entry.locale_ = nullptr;
    entry.options_ = nullptr;
    entry.formatter_ = nullptr;
  }
  numberFormatOptionfulNext_ = 0;
}

void js::intl::GlobalIntlData::resetDateTimeFormat() {
  dateTimeFormatLocale_ = nullptr;
  dateTimeFormatToLocaleAll_ = nullptr;
  dateTimeFormatToLocaleDate_ = nullptr;
  dateTimeFormatToLocaleTime_ = nullptr;
  for (auto& entry : dateTimeFormatOptionfulAll_) {
    entry.locale_ = nullptr;
    entry.options_ = nullptr;
    entry.formatter_ = nullptr;
  }
  for (auto& entry : dateTimeFormatOptionfulDate_) {
    entry.locale_ = nullptr;
    entry.options_ = nullptr;
    entry.formatter_ = nullptr;
  }
  for (auto& entry : dateTimeFormatOptionfulTime_) {
    entry.locale_ = nullptr;
    entry.options_ = nullptr;
    entry.formatter_ = nullptr;
  }
  dateTimeFormatOptionfulNext_ = 0;
}

bool js::intl::GlobalIntlData::ensureRealmLocale(JSContext* cx) {
  auto locale = cx->realm()->getLocale();
  if (realmLocale_ != locale) {
    realmLocale_ = locale;

    // Clear the cached default locale.
    defaultLocale_ = LanguageId::und();

    // Clear all cached instances when the realm locale has changed.
    resetCollator();
    resetNumberFormat();
    resetDateTimeFormat();
  }

  return true;
}

bool js::intl::GlobalIntlData::ensureRealmTimeZone(JSContext* cx) {
  TimeZoneIdentifierVector timeZoneId;
  if (!DateTimeInfo::timeZoneId(cx->realm()->getDateTimeInfo(), timeZoneId)) {
    ReportOutOfMemory(cx);
    return false;
  }

  if (!realmTimeZone_ || !StringEqualsAscii(realmTimeZone_, timeZoneId.begin(),
                                            timeZoneId.length())) {
    realmTimeZone_ = NewStringCopy<CanGC>(
        cx, static_cast<mozilla::Span<const char>>(timeZoneId));
    if (!realmTimeZone_) {
      return false;
    }

    // Clear the cached default time zone.
    defaultTimeZone_ = nullptr;
    defaultTimeZoneObject_ = nullptr;

    // Clear all cached DateTimeFormat instances when the time zone has changed.
    resetDateTimeFormat();
  }

  return true;
}

bool js::intl::GlobalIntlData::defaultLocale(JSContext* cx,
                                             LanguageId* result) {
  // Ensure the realm locale didn't change.
  if (!ensureRealmLocale(cx)) {
    return false;
  }

  // If we didn't have a cache hit, compute the candidate default locale.
  if (defaultLocale_ == LanguageId::und()) {
    // Cache the computed locale until the realm locale changes.
    auto locale = LanguageId::und();
    if (!ComputeDefaultLocale(cx, &locale)) {
      return false;
    }
    MOZ_ASSERT(locale != LanguageId::und(), "default locale is not 'und'");

    defaultLocale_ = locale;
  }
  *result = defaultLocale_;
  return true;
}

JSLinearString* js::intl::GlobalIntlData::defaultTimeZone(JSContext* cx) {
  // Ensure the realm time zone didn't change.
  if (!ensureRealmTimeZone(cx)) {
    return nullptr;
  }

  // If we didn't have a cache hit, compute the default time zone.
  if (!defaultTimeZone_) {
    // Cache the computed time zone until the realm time zone changes.
    defaultTimeZone_ = temporal::ComputeSystemTimeZoneIdentifier(cx);
  }
  return defaultTimeZone_;
}

static inline bool EqualLocale(const JSLinearString* str1,
                               const JSLinearString* str2) {
  if (str1 && str2) {
    return EqualStrings(str1, str2);
  }
  return !str1 && !str2;
}

static inline Value LocaleOrDefault(JSLinearString* locale) {
  if (locale) {
    return StringValue(locale);
  }
  return UndefinedValue();
}

CollatorObject* js::intl::GlobalIntlData::getOrCreateCollator(
    JSContext* cx, Handle<JSLinearString*> locale) {
  // Ensure the realm locale didn't change.
  if (!ensureRealmLocale(cx)) {
    return nullptr;
  }

  // Ensure the cached locale matches the requested locale.
  if (!EqualLocale(collatorLocale_, locale)) {
    resetCollator();
    collatorLocale_ = locale;
  }

  if (!collator_) {
    Rooted<Value> locales(cx, LocaleOrDefault(locale));
    auto* collator = CreateCollator(cx, locales, UndefinedHandleValue);
    if (!collator) {
      return nullptr;
    }
    collator_ = collator;
  }

  return &collator_->as<CollatorObject>();
}

NumberFormatObject* js::intl::GlobalIntlData::getOrCreateNumberFormat(
    JSContext* cx, Handle<JSLinearString*> locale) {
  // Ensure the realm locale didn't change.
  if (!ensureRealmLocale(cx)) {
    return nullptr;
  }

  // Ensure the cached locale matches the requested locale.
  if (!EqualLocale(numberFormatLocale_, locale)) {
    resetNumberFormat();
    numberFormatLocale_ = locale;
  }

  if (!numberFormat_) {
    Rooted<Value> locales(cx, LocaleOrDefault(locale));
    auto* numberFormat = CreateNumberFormat(cx, locales, UndefinedHandleValue);
    if (!numberFormat) {
      return nullptr;
    }
    numberFormat_ = numberFormat;
  }

  return &numberFormat_->as<NumberFormatObject>();
}

DateTimeFormatObject* js::intl::GlobalIntlData::getOrCreateDateTimeFormat(
    JSContext* cx, DateTimeFormatKind kind, Handle<JSLinearString*> locale) {
  // Ensure the realm didn't change.
  if (!ensureRealmLocale(cx)) {
    return nullptr;
  }

  // Ensure the realm time zone didn't change.
  if (!ensureRealmTimeZone(cx)) {
    return nullptr;
  }

  // Ensure the cached locale matches the requested locale.
  if (!EqualLocale(dateTimeFormatLocale_, locale)) {
    resetDateTimeFormat();
    dateTimeFormatLocale_ = locale;
  }

  JSObject* dtfObject = nullptr;
  switch (kind) {
    case DateTimeFormatKind::All:
      dtfObject = dateTimeFormatToLocaleAll_;
      break;
    case DateTimeFormatKind::Date:
      dtfObject = dateTimeFormatToLocaleDate_;
      break;
    case DateTimeFormatKind::Time:
      dtfObject = dateTimeFormatToLocaleTime_;
      break;
  }

  if (!dtfObject) {
    Rooted<Value> locales(cx, LocaleOrDefault(locale));
    auto* dateTimeFormat =
        CreateDateTimeFormat(cx, locales, UndefinedHandleValue, kind);
    if (!dateTimeFormat) {
      return nullptr;
    }

    switch (kind) {
      case DateTimeFormatKind::All:
        dateTimeFormatToLocaleAll_ = dateTimeFormat;
        break;
      case DateTimeFormatKind::Date:
        dateTimeFormatToLocaleDate_ = dateTimeFormat;
        break;
      case DateTimeFormatKind::Time:
        dateTimeFormatToLocaleTime_ = dateTimeFormat;
        break;
    }

    dtfObject = dateTimeFormat;
  }

  return &dtfObject->as<DateTimeFormatObject>();
}

temporal::TimeZoneObject* js::intl::GlobalIntlData::getOrCreateDefaultTimeZone(
    JSContext* cx) {
  // Ensure the realm time zone didn't change.
  if (!ensureRealmTimeZone(cx)) {
    return nullptr;
  }

  // If we didn't have a cache hit, compute the default time zone.
  if (!defaultTimeZoneObject_) {
    Rooted<JSLinearString*> identifier(cx, defaultTimeZone(cx));
    if (!identifier) {
      return nullptr;
    }

    auto* timeZone = temporal::CreateTimeZoneObject(cx, identifier, identifier);
    if (!timeZone) {
      return nullptr;
    }
    defaultTimeZoneObject_ = timeZone;
  }

  return &defaultTimeZoneObject_->as<temporal::TimeZoneObject>();
}

temporal::TimeZoneObject* js::intl::GlobalIntlData::getOrCreateTimeZone(
    JSContext* cx, Handle<JSLinearString*> identifier,
    Handle<JSLinearString*> primaryIdentifier) {
  // If there's a cached time zone, check if the identifiers are equal.
  if (timeZoneObject_) {
    auto* timeZone = &timeZoneObject_->as<temporal::TimeZoneObject>();
    if (EqualStrings(timeZone->identifier(), identifier)) {
      // Primary identifier must match when the identifiers are equal.
      MOZ_ASSERT(
          EqualStrings(timeZone->primaryIdentifier(), primaryIdentifier));

      // Return the cached time zone.
      return timeZone;
    }
  }

  // If we didn't have a cache hit, create a new time zone.
  auto* timeZone =
      temporal::CreateTimeZoneObject(cx, identifier, primaryIdentifier);
  if (!timeZone) {
    return nullptr;
  }
  timeZoneObject_ = timeZone;

  return &timeZone->as<temporal::TimeZoneObject>();
}

JS::Symbol* js::intl::GlobalIntlData::fallbackSymbol(JSContext* cx) {
  if (!fallbackSymbol_) {
    Handle<PropertyName*> description = cx->names().IntlLegacyConstructedSymbol;
    fallbackSymbol_ =
        JS::Symbol::new_(cx, JS::SymbolCode::UniqueSymbol, description);
  }
  return fallbackSymbol_;
}

JSObject* js::intl::GlobalIntlData::lookupOptionful(
    OptionfulEntry* entries, JS::Handle<JSLinearString*> locale,
    JS::Handle<JSObject*> options) {
  for (size_t i = 0; i < OptionfulCacheSize; i++) {
    OptionfulEntry& entry = entries[i];
    if (!entry.formatter_.get() || entry.options_.get() != options.get()) {
      continue;
    }
    if (!EqualLocale(entry.locale_.get(), locale.get())) {
      continue;
    }
    return entry.formatter_.get();
  }
  return nullptr;
}

void js::intl::GlobalIntlData::storeOptionful(
    OptionfulEntry* entries, size_t* next,
    JS::Handle<JSLinearString*> locale, JS::Handle<JSObject*> options,
    JS::Handle<JSObject*> formatter) {
  OptionfulEntry& entry = entries[*next % OptionfulCacheSize];
  entry.locale_ = locale;
  entry.options_ = options;
  entry.formatter_ = formatter;
  *next = (*next + 1) % OptionfulCacheSize;
}

GlobalIntlData::OptionfulEntry*
js::intl::GlobalIntlData::dateTimeFormatOptionfulEntries(
    DateTimeFormatKind kind) {
  switch (kind) {
    case DateTimeFormatKind::All:
      return dateTimeFormatOptionfulAll_;
    case DateTimeFormatKind::Date:
      return dateTimeFormatOptionfulDate_;
    case DateTimeFormatKind::Time:
      return dateTimeFormatOptionfulTime_;
  }
  MOZ_CRASH("invalid DateTimeFormatKind");
}

CollatorObject* js::intl::GlobalIntlData::lookupOptionfulCollator(
    JSContext* cx, JS::Handle<JSLinearString*> locale,
    JS::Handle<JSObject*> options) {
  if (!JS::Prefs::intl_optionful_cache()) {
    return nullptr;
  }
  if (!ensureRealmLocale(cx)) {
    return nullptr;
  }
  JSObject* hit = lookupOptionful(collatorOptionful_, locale, options);
  return hit ? &hit->as<CollatorObject>() : nullptr;
}

void js::intl::GlobalIntlData::storeOptionfulCollator(
    JS::Handle<JSLinearString*> locale, JS::Handle<JSObject*> options,
    JS::Handle<JSObject*> formatter) {
  storeOptionful(collatorOptionful_, &collatorOptionfulNext_, locale, options,
                 formatter);
}

NumberFormatObject* js::intl::GlobalIntlData::lookupOptionfulNumberFormat(
    JSContext* cx, JS::Handle<JSLinearString*> locale,
    JS::Handle<JSObject*> options) {
  if (!JS::Prefs::intl_optionful_cache()) {
    return nullptr;
  }
  if (!ensureRealmLocale(cx)) {
    return nullptr;
  }
  JSObject* hit = lookupOptionful(numberFormatOptionful_, locale, options);
  return hit ? &hit->as<NumberFormatObject>() : nullptr;
}

void js::intl::GlobalIntlData::storeOptionfulNumberFormat(
    JS::Handle<JSLinearString*> locale, JS::Handle<JSObject*> options,
    JS::Handle<JSObject*> formatter) {
  storeOptionful(numberFormatOptionful_, &numberFormatOptionfulNext_, locale,
                 options, formatter);
}

DateTimeFormatObject* js::intl::GlobalIntlData::lookupOptionfulDateTimeFormat(
    JSContext* cx, DateTimeFormatKind kind,
    JS::Handle<JSLinearString*> locale, JS::Handle<JSObject*> options) {
  if (!JS::Prefs::intl_optionful_cache()) {
    return nullptr;
  }
  if (!ensureRealmLocale(cx)) {
    return nullptr;
  }
  if (!ensureRealmTimeZone(cx)) {
    return nullptr;
  }
  JSObject* hit =
      lookupOptionful(dateTimeFormatOptionfulEntries(kind), locale, options);
  return hit ? &hit->as<DateTimeFormatObject>() : nullptr;
}

void js::intl::GlobalIntlData::storeOptionfulDateTimeFormat(
    DateTimeFormatKind kind, JS::Handle<JSLinearString*> locale,
    JS::Handle<JSObject*> options, JS::Handle<JSObject*> formatter) {
  storeOptionful(dateTimeFormatOptionfulEntries(kind),
                 &dateTimeFormatOptionfulNext_, locale, options, formatter);
}

void js::intl::GlobalIntlData::trace(JSTracer* trc) {
  TraceEdge(trc, &realmTimeZone_, "GlobalIntlData::realmTimeZone_");
  TraceEdge(trc, &defaultTimeZone_, "GlobalIntlData::defaultTimeZone_");
  TraceEdge(trc, &defaultTimeZoneObject_,
            "GlobalIntlData::defaultTimeZoneObject_");
  TraceEdge(trc, &timeZoneObject_, "GlobalIntlData::timeZoneObject_");

  TraceEdge(trc, &collatorLocale_, "GlobalIntlData::collatorLocale_");
  TraceEdge(trc, &collator_, "GlobalIntlData::collator_");

  TraceEdge(trc, &numberFormatLocale_, "GlobalIntlData::numberFormatLocale_");
  TraceEdge(trc, &numberFormat_, "GlobalIntlData::numberFormat_");

  TraceEdge(trc, &dateTimeFormatLocale_,
            "GlobalIntlData::dateTimeFormatLocale_");
  TraceEdge(trc, &dateTimeFormatToLocaleAll_,
            "GlobalIntlData::dateTimeFormatToLocaleAll_");
  TraceEdge(trc, &dateTimeFormatToLocaleDate_,
            "GlobalIntlData::dateTimeFormatToLocaleDate_");
  TraceEdge(trc, &dateTimeFormatToLocaleTime_,
            "GlobalIntlData::dateTimeFormatToLocaleTime_");

  for (size_t i = 0; i < OptionfulCacheSize; i++) {
    TraceEdge(trc, &collatorOptionful_[i].locale_, "GlobalIntlData::collatorOptionfulLocale");
    TraceEdge(trc, &collatorOptionful_[i].options_, "GlobalIntlData::collatorOptionfulOptions");
    TraceEdge(trc, &collatorOptionful_[i].formatter_, "GlobalIntlData::collatorOptionfulFormatter");
    TraceEdge(trc, &numberFormatOptionful_[i].locale_, "GlobalIntlData::numberFormatOptionfulLocale");
    TraceEdge(trc, &numberFormatOptionful_[i].options_, "GlobalIntlData::numberFormatOptionfulOptions");
    TraceEdge(trc, &numberFormatOptionful_[i].formatter_, "GlobalIntlData::numberFormatOptionfulFormatter");
    TraceEdge(trc, &dateTimeFormatOptionfulAll_[i].locale_, "GlobalIntlData::dateTimeFormatOptionfulAllLocale");
    TraceEdge(trc, &dateTimeFormatOptionfulAll_[i].options_, "GlobalIntlData::dateTimeFormatOptionfulAllOptions");
    TraceEdge(trc, &dateTimeFormatOptionfulAll_[i].formatter_, "GlobalIntlData::dateTimeFormatOptionfulAllFormatter");
    TraceEdge(trc, &dateTimeFormatOptionfulDate_[i].locale_, "GlobalIntlData::dateTimeFormatOptionfulDateLocale");
    TraceEdge(trc, &dateTimeFormatOptionfulDate_[i].options_, "GlobalIntlData::dateTimeFormatOptionfulDateOptions");
    TraceEdge(trc, &dateTimeFormatOptionfulDate_[i].formatter_, "GlobalIntlData::dateTimeFormatOptionfulDateFormatter");
    TraceEdge(trc, &dateTimeFormatOptionfulTime_[i].locale_, "GlobalIntlData::dateTimeFormatOptionfulTimeLocale");
    TraceEdge(trc, &dateTimeFormatOptionfulTime_[i].options_, "GlobalIntlData::dateTimeFormatOptionfulTimeOptions");
    TraceEdge(trc, &dateTimeFormatOptionfulTime_[i].formatter_, "GlobalIntlData::dateTimeFormatOptionfulTimeFormatter");
  }

  TraceEdge(trc, &fallbackSymbol_, "GlobalIntlData::fallbackSymbol_");
}
