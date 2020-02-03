interface ControlledWatchHost {
  invokeFileCreated: (path: string) => void;
  invokeFileChanged: (path: string) => void;
  invokeFileDeleted: (path: string) => void;
}

export { ControlledWatchHost };
