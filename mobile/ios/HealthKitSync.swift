import Foundation
import HealthKit

final class HealthKitSync {
    private let store = HKHealthStore()

    func requestAuthorization() async throws {
        guard HKHealthStore.isHealthDataAvailable() else { return }

        let readTypes: Set<HKObjectType> = [
            HKQuantityType.quantityType(forIdentifier: .stepCount)!,
            HKQuantityType.quantityType(forIdentifier: .activeEnergyBurned)!,
            HKQuantityType.quantityType(forIdentifier: .basalEnergyBurned)!,
            HKQuantityType.quantityType(forIdentifier: .restingHeartRate)!,
            HKQuantityType.quantityType(forIdentifier: .heartRate)!,
            HKObjectType.categoryType(forIdentifier: .sleepAnalysis)!,
            HKObjectType.workoutType()
        ]

        try await store.requestAuthorization(toShare: [], read: readTypes)
    }

    func syncToday(apiBaseURL: URL, token: String) async throws {
        let calendar = Calendar.current
        let start = calendar.startOfDay(for: Date())
        let end = Date()

        async let steps = quantitySum(.stepCount, unit: .count(), start: start, end: end)
        async let activeEnergy = quantitySum(.activeEnergyBurned, unit: .kilocalorie(), start: start, end: end)
        async let restingEnergy = quantitySum(.basalEnergyBurned, unit: .kilocalorie(), start: start, end: end)
        async let restingHeartRate = quantityAverage(.restingHeartRate, unit: HKUnit.count().unitDivided(by: .minute()), start: start, end: end)
        async let averageHeartRate = quantityAverage(.heartRate, unit: HKUnit.count().unitDivided(by: .minute()), start: start, end: end)
        async let sleepMinutes = sleepMinutes(start: start, end: end)
        async let workoutMinutes = workoutMinutes(start: start, end: end)

        let payload = DailyHealthPayload(
            date: isoDate(start),
            steps: Int(try await steps),
            activeEnergyKcal: try await activeEnergy,
            restingEnergyKcal: try await restingEnergy,
            workoutMinutes: Int(try await workoutMinutes),
            sleepMinutes: Int(try await sleepMinutes),
            restingHeartRateBpm: optionalInt(try await restingHeartRate),
            averageHeartRateBpm: optionalInt(try await averageHeartRate),
            source: "apple_health"
        )

        var request = URLRequest(url: apiBaseURL.appending(path: "/api/mobile/health/daily"))
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(payload)

        let (_, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw URLError(.badServerResponse)
        }
    }

    private func quantitySum(_ identifier: HKQuantityTypeIdentifier, unit: HKUnit, start: Date, end: Date) async throws -> Double {
        guard let type = HKQuantityType.quantityType(forIdentifier: identifier) else { return 0 }
        let predicate = HKQuery.predicateForSamples(withStart: start, end: end)

        return try await withCheckedThrowingContinuation { continuation in
            let query = HKStatisticsQuery(quantityType: type, quantitySamplePredicate: predicate, options: .cumulativeSum) { _, stats, error in
                if let error {
                    continuation.resume(throwing: error)
                } else {
                    continuation.resume(returning: stats?.sumQuantity()?.doubleValue(for: unit) ?? 0)
                }
            }
            store.execute(query)
        }
    }

    private func quantityAverage(_ identifier: HKQuantityTypeIdentifier, unit: HKUnit, start: Date, end: Date) async throws -> Double? {
        guard let type = HKQuantityType.quantityType(forIdentifier: identifier) else { return nil }
        let predicate = HKQuery.predicateForSamples(withStart: start, end: end)

        return try await withCheckedThrowingContinuation { continuation in
            let query = HKStatisticsQuery(quantityType: type, quantitySamplePredicate: predicate, options: .discreteAverage) { _, stats, error in
                if let error {
                    continuation.resume(throwing: error)
                } else {
                    continuation.resume(returning: stats?.averageQuantity()?.doubleValue(for: unit))
                }
            }
            store.execute(query)
        }
    }

    private func sleepMinutes(start: Date, end: Date) async throws -> Double {
        guard let type = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) else { return 0 }
        let predicate = HKQuery.predicateForSamples(withStart: start, end: end)

        return try await withCheckedThrowingContinuation { continuation in
            let query = HKSampleQuery(sampleType: type, predicate: predicate, limit: HKObjectQueryNoLimit, sortDescriptors: nil) { _, samples, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }

                let total = (samples as? [HKCategorySample] ?? [])
                    .filter { $0.value == HKCategoryValueSleepAnalysis.asleepCore.rawValue || $0.value == HKCategoryValueSleepAnalysis.asleepDeep.rawValue || $0.value == HKCategoryValueSleepAnalysis.asleepREM.rawValue }
                    .reduce(0) { $0 + $1.endDate.timeIntervalSince($1.startDate) / 60 }

                continuation.resume(returning: total)
            }
            store.execute(query)
        }
    }

    private func workoutMinutes(start: Date, end: Date) async throws -> Double {
        let predicate = HKQuery.predicateForSamples(withStart: start, end: end)

        return try await withCheckedThrowingContinuation { continuation in
            let query = HKSampleQuery(sampleType: .workoutType(), predicate: predicate, limit: HKObjectQueryNoLimit, sortDescriptors: nil) { _, samples, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }

                let total = (samples as? [HKWorkout] ?? []).reduce(0) { $0 + $1.duration / 60 }
                continuation.resume(returning: total)
            }
            store.execute(query)
        }
    }

    private func isoDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .iso8601)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }

    private func optionalInt(_ value: Double?) -> Int? {
        guard let value else { return nil }
        return Int(value.rounded())
    }
}

struct DailyHealthPayload: Encodable {
    let date: String
    let steps: Int
    let activeEnergyKcal: Double
    let restingEnergyKcal: Double
    let workoutMinutes: Int
    let sleepMinutes: Int
    let restingHeartRateBpm: Int?
    let averageHeartRateBpm: Int?
    let source: String
}

