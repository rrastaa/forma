export type SelectedFile = {
    name: string;
    path: string;
    extension: string;
  };
  
 export type ProgressData = {
    current: number;
    total: number;
    percentage: number;
    message: string;
  };