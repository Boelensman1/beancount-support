{ pkgs ? import <nixpkgs> {} }:

let
  beangulp = pkgs.callPackage ./packages/beangulp.nix {};
  beanprice = pkgs.callPackage ./packages/beanprice.nix {};
  beanquery = pkgs.callPackage ./packages/beanquery.nix {};
  fava = pkgs.callPackage ./packages/fava.nix {};
  beancount3 = pkgs.callPackage ./packages/beancount3.nix {};
in pkgs.mkShell {
  buildInputs = [
    beanprice
    beangulp
    beanquery
    beancount3
  ];

  # Add shellHook to add beanprice sources to PYTHONPATH
  shellHook = ''
    export PYTHONPATH=$PYTHONPATH:${toString ./pythonpackages}
    '';
}

