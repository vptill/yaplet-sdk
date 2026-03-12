const modules = {};

const ModuleRegistry = {
  register(name, module) {
    modules[name] = module;
  },
  get(name) {
    return modules[name] || null;
  },
};

export default ModuleRegistry;
