import "@typespec/http";
import "@typespec/openapi";
import "@typespec/openapi3";
import "@typespec/json-schema";

using Http;
using OpenAPI;

/**
 * «Запись на звонок»: владелец календаря публикует типы встреч, гость выбирает свободный слот и бронирует звонок.
 *
 * Авторизации нет: владелец — один заранее заданный профиль, гости бронируют без аккаунта.
 * Маршруты владельца отделены префиксом `/api/admin`.
 *
 * Правила бронирования:
 * - слоты считаются в рабочие дни и часы владельца (в его часовом поясе) на `bookingWindowDays` дней вперёд, начиная с сегодняшнего дня;
 * - шаг слотов равен длительности типа встречи, прошедшие слоты недоступны;
 * - на одно и то же время нельзя создать две записи, даже если это разные типы встреч.
 */
@service(#{ title: "Call Booking API" })
@info(#{ version: "1.0.0" })
@server("http://localhost:8080", "Local server")
namespace CallBooking;

// ---------- Models ----------

@doc("Профиль владельца календаря (единственный, задаётся конфигурацией сервера).")
@example(#{
  name: "Анна Смирнова",
  timezone: "Europe/Moscow",
  workdayStart: "09:00",
  workdayEnd: "18:00",
  workingDays: #[1, 2, 3, 4, 5],
  bookingWindowDays: 14,
})
model Owner {
  name: string;

  @doc("IANA-часовой пояс владельца, в котором заданы рабочие часы.")
  timezone: string;

  @doc("Начало рабочего дня, HH:mm.")
  @pattern("^([01]\\d|2[0-3]):[0-5]\\d$")
  workdayStart: string;

  @doc("Конец рабочего дня, HH:mm.")
  @pattern("^([01]\\d|2[0-3]):[0-5]\\d$")
  workdayEnd: string;

  @doc("Рабочие дни недели по ISO 8601: 1 — понедельник, 7 — воскресенье.")
  workingDays: int32[];

  @doc("На сколько дней вперёд (включая сегодня) открыта запись.")
  bookingWindowDays: int32;
}

@doc("Тип встречи, на который гость может записаться.")
@example(#{
  id: "consultation",
  name: "Консультация",
  description: "Обсудим ваш проект и ответим на вопросы.",
  durationMinutes: 30,
})
model EventType {
  @doc("Человекочитаемый идентификатор (slug), задаётся владельцем.")
  @pattern("^[a-z0-9]+(?:-[a-z0-9]+)*$")
  @minLength(2)
  @maxLength(64)
  id: string;

  @minLength(1)
  @maxLength(100)
  name: string;

  @maxLength(500)
  description: string;

  @doc("Длительность встречи в минутах, кратна 5.")
  @minValue(5)
  @maxValue(240)
  @JsonSchema.multipleOf(5)
  durationMinutes: int32;
}

@doc("Слот в расписании для конкретного типа встречи: интервал [startAt, endAt).")
@example(#{
  startAt: utcDateTime.fromISO("2026-11-10T06:00:00Z"),
  endAt: utcDateTime.fromISO("2026-11-10T06:30:00Z"),
  available: true,
})
model TimeSlot {
  startAt: utcDateTime;
  endAt: utcDateTime;

  @doc("false — время уже занято другой записью (любого типа).")
  available: boolean;
}

@doc("Запрос гостя на бронирование. `startAt` должен совпадать с началом свободного слота.")
@example(#{
  eventTypeId: "consultation",
  startAt: utcDateTime.fromISO("2026-11-10T06:00:00Z"),
  guestName: "Иван Петров",
  guestEmail: "ivan@example.com",
  comment: "Хочу обсудить архитектуру сервиса",
})
model CreateBookingRequest {
  eventTypeId: string;
  startAt: utcDateTime;

  @minLength(1)
  @maxLength(100)
  guestName: string;

  @format("email")
  @maxLength(254)
  guestEmail: string;

  @maxLength(1000)
  comment?: string;
}

@doc("Подтверждённая запись на звонок.")
@example(#{
  id: "6ba7b810-9dad-41d1-80b4-00c04fd430c8",
  eventTypeId: "consultation",
  eventTypeName: "Консультация",
  startAt: utcDateTime.fromISO("2026-11-10T06:00:00Z"),
  endAt: utcDateTime.fromISO("2026-11-10T06:30:00Z"),
  guestName: "Иван Петров",
  guestEmail: "ivan@example.com",
  comment: "Хочу обсудить архитектуру сервиса",
  createdAt: utcDateTime.fromISO("2026-11-06T12:00:00Z"),
})
model Booking {
  @format("uuid")
  id: string;

  eventTypeId: string;
  eventTypeName: string;
  startAt: utcDateTime;
  endAt: utcDateTime;
  guestName: string;
  guestEmail: string;
  comment?: string;
  createdAt: utcDateTime;
}

@doc("Ошибка валидации конкретного поля.")
model FieldError {
  field: string;
  message: string;
}

@error
@doc("Некорректный запрос: невалидные поля или время, которое нельзя забронировать.")
model BadRequestError {
  @statusCode _: 400;

  @doc("VALIDATION_ERROR — невалидные поля; SLOT_UNAVAILABLE — время не является свободным слотом (прошло, вне окна записи или рабочих часов, не выровнено по сетке).")
  code: "VALIDATION_ERROR" | "SLOT_UNAVAILABLE";

  message: string;
  details?: FieldError[];
}

@error
@doc("Ресурс не найден.")
model NotFoundError {
  @statusCode _: 404;
  code: "NOT_FOUND";
  message: string;
}

@error
@doc("Конфликт с текущим состоянием.")
model ConflictError {
  @statusCode _: 409;

  @doc("SLOT_TAKEN — время пересекается с существующей записью; EVENT_TYPE_ALREADY_EXISTS — тип с таким id уже есть.")
  code: "SLOT_TAKEN" | "EVENT_TYPE_ALREADY_EXISTS";

  message: string;
}

// ---------- Guest routes ----------

@tag("Guest")
@route("/api")
namespace Public {
  @get
  @route("/owner")
  @summary("Профиль владельца календаря")
  op getOwner(): Owner;

  @get
  @route("/event-types")
  @summary("Список типов встреч")
  @opExample(#{
    returnType: #[
      #{
        id: "consultation",
        name: "Консультация",
        description: "Обсудим ваш проект и ответим на вопросы.",
        durationMinutes: 30,
      },
      #{
        id: "code-review",
        name: "Ревью кода",
        description: "Совместный разбор пулл-реквеста.",
        durationMinutes: 45,
      },
      #{
        id: "tech-interview",
        name: "Техническое интервью",
        description: "Часовой созвон с задачами и разбором решений.",
        durationMinutes: 60,
      }
    ],
  })
  op listEventTypes(): EventType[];

  @get
  @route("/event-types/{eventTypeId}")
  @summary("Тип встречи по id")
  op getEventType(@path eventTypeId: string): EventType | NotFoundError;

  @get
  @route("/event-types/{eventTypeId}/slots")
  @summary("Слоты для записи на ближайшие bookingWindowDays дней")
  @doc("Все слоты в окне записи, отсортированные по времени. Прошедшие слоты не возвращаются; занятые возвращаются с `available: false`.")
  @opExample(#{
    returnType: #[
      #{
        startAt: utcDateTime.fromISO("2026-11-10T06:00:00Z"),
        endAt: utcDateTime.fromISO("2026-11-10T06:30:00Z"),
        available: true,
      },
      #{
        startAt: utcDateTime.fromISO("2026-11-10T06:30:00Z"),
        endAt: utcDateTime.fromISO("2026-11-10T07:00:00Z"),
        available: false,
      },
      #{
        startAt: utcDateTime.fromISO("2026-11-10T07:00:00Z"),
        endAt: utcDateTime.fromISO("2026-11-10T07:30:00Z"),
        available: true,
      },
      #{
        startAt: utcDateTime.fromISO("2026-11-11T08:00:00Z"),
        endAt: utcDateTime.fromISO("2026-11-11T08:30:00Z"),
        available: true,
      }
    ],
  })
  op listSlots(@path eventTypeId: string): TimeSlot[] | NotFoundError;

  @post
  @route("/bookings")
  @summary("Забронировать слот")
  op createBooking(@body body: CreateBookingRequest): {
    @statusCode statusCode: 201;
    @body body: Booking;
  } | BadRequestError | NotFoundError | ConflictError;
}

// ---------- Owner routes ----------

@tag("Owner")
@route("/api/admin")
namespace Admin {
  @post
  @route("/event-types")
  @summary("Создать тип встречи")
  op createEventType(@body body: EventType): {
    @statusCode statusCode: 201;
    @body body: EventType;
  } | BadRequestError | ConflictError;

  @get
  @route("/bookings")
  @summary("Предстоящие встречи")
  @doc("Записи всех типов, которые ещё не закончились, одним списком по возрастанию startAt.")
  @opExample(#{
    returnType: #[
      #{
        id: "6ba7b810-9dad-41d1-80b4-00c04fd430c8",
        eventTypeId: "consultation",
        eventTypeName: "Консультация",
        startAt: utcDateTime.fromISO("2026-11-10T06:30:00Z"),
        endAt: utcDateTime.fromISO("2026-11-10T07:00:00Z"),
        guestName: "Иван Петров",
        guestEmail: "ivan@example.com",
        comment: "Хочу обсудить архитектуру сервиса",
        createdAt: utcDateTime.fromISO("2026-11-06T12:00:00Z"),
      },
      #{
        id: "9b2f3c1e-4a5d-4e6f-8a7b-1c2d3e4f5a6b",
        eventTypeId: "code-review",
        eventTypeName: "Ревью кода",
        startAt: utcDateTime.fromISO("2026-11-11T09:00:00Z"),
        endAt: utcDateTime.fromISO("2026-11-11T09:45:00Z"),
        guestName: "Мария Козлова",
        guestEmail: "maria@example.com",
        createdAt: utcDateTime.fromISO("2026-11-06T13:30:00Z"),
      }
    ],
  })
  op listUpcomingBookings(): Booking[];
}
