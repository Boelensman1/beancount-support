{ pkgs ? import <nixpkgs> {} }:

let
  beangulp = pkgs.callPackage ./packages/beangulp.nix {};
  beanprice = pkgs.callPackage ./packages/beanprice.nix {};
  beanquery = pkgs.callPackage ./packages/beanquery.nix {};
  fava = pkgs.callPackage ./packages/fava.nix {};
  beancount3 = pkgs.callPackage ./packages/beancount3.nix {};
  beangrow= pkgs.callPackage ./packages/beangrow.nix {};
in pkgs.mkShell {
  buildInputs = [
    beanprice
    beangulp
    beanquery
    beangrow
    beancount3
  ];

  # Add shellHook to add beanprice sources to PYTHONPATH
  shellHook = ''
    export PYTHONPATH=$PYTHONPATH:${pkgs.lib.escapeShellArg ./pythonpackages}
    '';
}

