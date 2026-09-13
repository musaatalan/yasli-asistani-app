import ExpoModulesCore

public class AutoSmsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("AutoSms")

    AsyncFunction("sendSms") { (_: String, _: String) in
      throw NSError(
        domain: "AutoSms",
        code: 1,
        userInfo: [NSLocalizedDescriptionKey: "iOS sessiz SMS desteklemez"]
      )
    }

    Function("isAvailable") { () -> Bool in
      return false
    }
  }
}
