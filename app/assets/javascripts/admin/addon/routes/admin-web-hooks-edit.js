import DiscourseRoute from "discourse/routes/discourse";

export default DiscourseRoute.extend({
  serialize(model) {
    return { web_hook_id: model.id || "new" };
  },

  model(params) {
    if (params.web_hook_id === "new") {
      return this.store.createRecord("web-hook");
    }

    return this.store.find("web-hook", params.web_hook_id);
  },

  setupController(controller, model) {
    this._super(...arguments);

    if (model.get("isNew")) {
      model.set(
        "web_hook_event_types",
        this.controllerFor("adminWebHooks").defaultEventTypes
      );
    }

    controller.set("saved", false);
  },
});
